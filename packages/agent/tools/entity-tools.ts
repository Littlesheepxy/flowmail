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

				return {
					id: entity.id,
					title: entity.title,
					type: entity.type,
					status: entity.status,
					aiSummary: entity.aiSummary,
					extractedFields,
					aiConfidence: entity.aiConfidence,
					// 信息充分性信号
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
					.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"])
					.describe("新的分类类型"),
				reason: z.string().optional().describe("重新分类的原因"),
			}),
			execute: async (input: {
				entityId: string;
				newType: "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK";
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
					data: { type: input.newType },
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
	};
}
