import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";

export function createEntityTools(deps: {
	triggerNotification: (params: {
		organizationId: string;
		type: string;
		entityId: string;
		title: string;
		body: string;
	}) => Promise<unknown>;
	reEnrich?: (entityId: string) => Promise<{
		success: boolean;
		entityType: string;
		confidence: number;
		summary: string;
		extractedFieldCount: number;
		error?: string;
	}>;
	enrichEntityById?: (entityId: string) => Promise<{
		entityId: string;
		type: string;
		categorySlug?: string;
		confidence: number;
		summary: string;
	}>;
}) {
	return {
		get_entity: tool({
			description:
				"获取业务事项的完整详情，包括 AI 摘要、抽取字段和时间线。分析事项时首先调用。返回结果中包含 attachmentCount（附件数量）和 bodyLength（邮件正文长度），用于判断是否需要进一步读取附件。",
			inputSchema: z.object({
				entityId: z.string().describe("Entity ID"),
			}),
			execute: async (input: { entityId: string }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
					include: {
						timeline: { orderBy: { createdAt: "asc" }, take: 10 },
						threads: {
							select: {
								id: true,
								subject: true,
								sender: true,
								receivedAt: true,
								bodyText: true,
								attachments: { select: { id: true, filename: true, mimeType: true } },
							},
							take: 3,
						},
					},
				});
				if (!entity) {
					return { error: "Entity not found" };
				}

				const allAttachments = entity.threads.flatMap((t) => t.attachments);
				const bodyLength = entity.threads
					.map((t) => (t.bodyText ?? "").length)
					.reduce((a, b) => a + b, 0);

				let extractedFields: Record<string, unknown> = {};
				try {
					extractedFields = entity.extractedFields
						? (JSON.parse(entity.extractedFields as string) as Record<string, unknown>)
						: {};
				} catch {
					// ignore
				}

				const extractedFieldCount = Object.keys(extractedFields).length;

				const needsReEnrich = !entity.aiSummary && bodyLength > 100;

				return {
					id: entity.id,
					title: entity.title,
					type: entity.type,
					status: entity.status,
					aiSummary: entity.aiSummary || (needsReEnrich ? "[AI 摘要为空，建议调用 re_enrich_entity 重新分析]" : ""),
					extractedFields,
					aiConfidence: entity.aiConfidence,
					needsReEnrich,
					attachmentCount: allAttachments.length,
					attachments: allAttachments.map((a) => ({
						id: a.id,
						filename: a.filename,
						mimeType: a.mimeType,
					})),
					bodyLength,
					extractedFieldCount,
					// 建议：是否需要读附件
					needsAttachmentRead:
						allAttachments.length > 0 &&
						(bodyLength < 200 || extractedFieldCount < 2 || (entity.aiConfidence ?? 1) < 0.6),
					timelineCount: entity.timeline.length,
					latestEvents: entity.timeline.slice(-5).map((e) => ({
						type: e.type,
						content: e.content,
						createdAt: e.createdAt,
					})),
				};
			},
		}),

		read_email_body: tool({
			description:
				"读取事项关联的邮件原始正文。当 aiSummary 为空、需要分析邮件内容、或用户要求查看正文时调用。返回截断到 4000 字符的纯文本。",
			inputSchema: z.object({
				entityId: z.string().describe("Entity ID"),
			}),
			execute: async (input: { entityId: string }) => {
				const threads = await db.emailThread.findMany({
					where: { entityId: input.entityId },
					select: {
						id: true,
						subject: true,
						sender: true,
						receivedAt: true,
						bodyText: true,
					},
					orderBy: { receivedAt: "desc" },
					take: 3,
				});
				if (threads.length === 0) {
					return { error: "No email threads found for this entity" };
				}
				return {
					threadCount: threads.length,
					emails: threads.map((t) => ({
						subject: t.subject,
						sender: t.sender,
						receivedAt: t.receivedAt,
						body: (t.bodyText ?? "").slice(0, 4000),
						truncated: (t.bodyText ?? "").length > 4000,
						fullLength: (t.bodyText ?? "").length,
					})),
				};
			},
		}),

		re_enrich_entity: tool({
			description:
				"重新触发 AI 分类、字段抽取和摘要生成。当事项的 aiSummary 为空、分类为 FEEDBACK 但看起来应该是其他类型、或 aiConfidence 很低时调用。",
			inputSchema: z.object({
				entityId: z.string().describe("Entity ID"),
			}),
			execute: async (input: { entityId: string }) => {
				if (!deps.reEnrich) {
					return { error: "re_enrich not configured" };
				}
				return deps.reEnrich(input.entityId);
			},
		}),

		ask_user: tool({
			description:
				"向用户提问并提供可选选项。当 Agent 需要用户确认、选择分类、决定下一步操作等场景使用。必须提供 2-5 个选项让用户点选。",
			inputSchema: z.object({
				question: z.string().describe("要问用户的问题"),
				options: z
					.array(
						z.object({
							label: z.string().describe("选项显示文本"),
							value: z.string().describe("选项值，用户选择后会作为回复发送"),
						}),
					)
					.min(2)
					.max(5)
					.describe("供用户选择的选项列表"),
				context: z.string().optional().describe("补充说明，帮助用户理解为什么需要选择"),
			}),
			execute: async (input: {
				question: string;
				options: Array<{ label: string; value: string }>;
				context?: string;
			}) => {
				return {
					type: "ask_user" as const,
					question: input.question,
					options: input.options,
					context: input.context,
					awaiting: true,
				};
			},
		}),

		approve_entity: tool({
			description: "批准待审批的请求。仅在用户明确要求批准时调用。",
			inputSchema: z.object({
				entityId: z.string(),
				comment: z.string().optional().describe("Optional approval comment"),
			}),
			execute: async (input: { entityId: string; comment?: string }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
				});
				if (!entity) {
					return { error: "Not found" };
				}
				if (entity.type !== "APPROVAL" || entity.status !== "pending") {
					return { error: "Entity is not a pending approval" };
				}
				await db.flowEntity.update({
					where: { id: input.entityId },
					data: { status: "approved" },
				});
				await db.timelineEvent.create({
					data: {
						entityId: input.entityId,
						type: "action_taken",
						content: `已通过 Agent 批准${input.comment ? `：${input.comment}` : ""}`,
						metadata: JSON.stringify({
							action: "approved",
							comment: input.comment,
							via: "agent",
						}),
					},
				});
				deps.triggerNotification({
					organizationId: entity.organizationId,
					type: "STATUS_CHANGED",
					entityId: input.entityId,
					title: `已批准：${entity.title}`,
					body: `审批事项「${entity.title}」已通过 Agent 批准。`,
				}).catch(() => {});
				return {
					success: true,
					fromStatus: "pending",
					toStatus: "approved",
					title: entity.title,
				};
			},
		}),

		reject_entity: tool({
			description: "拒绝待审批的请求。需要提供拒绝理由。",
			inputSchema: z.object({
				entityId: z.string(),
				reason: z.string().describe("Reason for rejection"),
			}),
			execute: async (input: { entityId: string; reason: string }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
				});
				if (!entity) {
					return { error: "Not found" };
				}
				if (entity.type !== "APPROVAL" || entity.status !== "pending") {
					return { error: "Entity is not a pending approval" };
				}
				await db.flowEntity.update({
					where: { id: input.entityId },
					data: { status: "rejected" },
				});
				await db.timelineEvent.create({
					data: {
						entityId: input.entityId,
						type: "action_taken",
						content: `已通过 Agent 拒绝：${input.reason}`,
						metadata: JSON.stringify({
							action: "rejected",
							reason: input.reason,
							via: "agent",
						}),
					},
				});
				deps.triggerNotification({
					organizationId: entity.organizationId,
					type: "STATUS_CHANGED",
					entityId: input.entityId,
					title: `已拒绝：${entity.title}`,
					body: `审批事项「${entity.title}」已通过 Agent 拒绝：${input.reason}`,
				}).catch(() => {});
				return {
					success: true,
					fromStatus: "pending",
					toStatus: "rejected",
					title: entity.title,
				};
			},
		}),

		update_entity_status: tool({
			description: "更新事项状态。用于状态变更，如调查中、进行中、已阻塞等。",
			inputSchema: z.object({
				entityId: z.string(),
				status: z.string().describe("New status value"),
				reason: z.string().optional().describe("Reason for status change"),
			}),
			execute: async (input: {
				entityId: string;
				status: string;
				reason?: string;
			}) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
				});
				if (!entity) {
					return { error: "Not found" };
				}
				const previousStatus = entity.status;
				await db.flowEntity.update({
					where: { id: input.entityId },
					data: { status: input.status },
				});
				await db.timelineEvent.create({
					data: {
						entityId: input.entityId,
						type: "status_changed",
						content: `状态变更：${previousStatus} → ${input.status}${input.reason ? `（${input.reason}）` : ""}`,
						metadata: JSON.stringify({
							previousStatus,
							newStatus: input.status,
							reason: input.reason,
							via: "agent",
						}),
					},
				});
				deps.triggerNotification({
					organizationId: entity.organizationId,
					type: "STATUS_CHANGED",
					entityId: input.entityId,
					title: `状态变更：${entity.title}`,
					body: `事项「${entity.title}」状态从 ${previousStatus} 变为 ${input.status}`,
				}).catch(() => {});
				return {
					success: true,
					fromStatus: previousStatus,
					toStatus: input.status,
					title: entity.title,
				};
			},
		}),

		update_entity_type: tool({
			description:
				"重新分类事项。当用户说'这不是审批，是报告'、'分类错了'、'改成 ISSUE' 时调用。",
			inputSchema: z.object({
				entityId: z.string(),
				newType: z
					.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK", "NOISE"])
					.describe("新的分类类型"),
				reason: z.string().optional().describe("重新分类的原因"),
			}),
			execute: async (input: {
				entityId: string;
				newType: "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK" | "NOISE";
				reason?: string;
			}) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
				});
				if (!entity) {
					return { error: "Not found" };
				}
				const previousType = entity.type;
				await db.flowEntity.update({
					where: { id: input.entityId },
					data: {
						type: input.newType,
						isFiltered: input.newType === "NOISE",
					},
				});
				await db.timelineEvent.create({
					data: {
						entityId: input.entityId,
						type: "action_taken",
						content: `分类变更：${previousType} → ${input.newType}${input.reason ? `（${input.reason}）` : ""}`,
						metadata: JSON.stringify({
							action: "reclassify",
							previousType,
							newType: input.newType,
							reason: input.reason,
							via: "agent",
						}),
					},
				});
				return {
					success: true,
					fromType: previousType,
					toType: input.newType,
					title: entity.title,
				};
			},
		}),

		add_note: tool({
			description: "向事项时间线添加备注或里程碑。",
			inputSchema: z.object({
				entityId: z.string(),
				content: z.string().describe("Note content"),
				type: z.enum(["note", "milestone"]).default("note"),
			}),
			execute: async (input: {
				entityId: string;
				content: string;
				type: "note" | "milestone";
			}) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
					select: { id: true, title: true },
				});
				if (!entity) {
					return { error: "Not found" };
				}
				await db.timelineEvent.create({
					data: {
						entityId: input.entityId,
						type: input.type,
						content: input.content,
						metadata: JSON.stringify({ via: "agent" }),
					},
				});
				return { success: true, content: input.content, type: input.type };
			},
		}),

		batch_enrich: tool({
			description:
				"批量对未经 AI 分析的事项执行 AI 分类和摘要。先用 list_entities(unanalyzed=true) 获取待分析列表，再调用本工具传入 entityId 数组。每次最多处理 10 个。",
			inputSchema: z.object({
				organizationId: z.string().describe("组织 ID"),
				entityIds: z.array(z.string()).min(1).max(10).describe("待分析的事项 ID 列表，最多 10 个"),
			}),
			execute: async (input: { organizationId: string; entityIds: string[] }) => {
				if (!deps.enrichEntityById) {
					return { error: "enrichEntityById not available" };
				}

				const results: { entityId: string; status: "ok" | "error"; categorySlug?: string; summary?: string; error?: string }[] = [];

				for (const entityId of input.entityIds) {
					try {
						const result = await deps.enrichEntityById(entityId);
						results.push({
							entityId,
							status: "ok",
							categorySlug: result.categorySlug,
							summary: result.summary?.slice(0, 100),
						});
					} catch (err) {
						results.push({
							entityId,
							status: "error",
							error: err instanceof Error ? err.message : "Unknown error",
						});
					}
				}

				return {
					total: input.entityIds.length,
					succeeded: results.filter((r) => r.status === "ok").length,
					failed: results.filter((r) => r.status === "error").length,
					results,
				};
			},
		}),
	};
}
