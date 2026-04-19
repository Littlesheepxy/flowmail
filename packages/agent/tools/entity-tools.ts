import { fastModel, safeGenerateObject, tool } from "@repo/ai";
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

		merge_entities: tool({
			description:
				"将两个事项合并为同一个：把【源事项】的所有邮件、时间线、收件箱关联和标签全部迁移到【目标事项】，源事项被删除。当用户说【这两个是同一个项目】【把 X 合并到 Y】【这俩重复了】，或在分析中发现两条 entity 实际指向同一业务时调用。⚠️ 不可逆，调用前应通过 ask_user 让用户确认。",
			inputSchema: z.object({
				targetEntityId: z
					.string()
					.describe("目标事项 ID（保留下来的事项，所有数据合并到这里）"),
				sourceEntityId: z
					.string()
					.describe("源事项 ID（合并后会被删除）"),
				reason: z.string().optional().describe("合并原因，会写入时间线"),
			}),
			execute: async (input: {
				targetEntityId: string;
				sourceEntityId: string;
				reason?: string;
			}) => {
				if (input.targetEntityId === input.sourceEntityId) {
					return { error: "目标和源事项不能相同" };
				}

				const [target, source] = await Promise.all([
					db.flowEntity.findUnique({
						where: { id: input.targetEntityId },
						select: { id: true, organizationId: true, title: true },
					}),
					db.flowEntity.findUnique({
						where: { id: input.sourceEntityId },
						include: {
							threads: { select: { id: true } },
							timeline: { select: { id: true } },
							tags: { select: { id: true, tagId: true } },
							inboundEmails: { select: { id: true } },
						},
					}),
				]);

				if (!target || !source) {
					return { error: "事项不存在" };
				}
				if (target.organizationId !== source.organizationId) {
					return { error: "不能跨组织合并" };
				}

				const threadIds = source.threads.map((t) => t.id);
				const timelineIds = source.timeline.map((t) => t.id);
				const inboundIds = source.inboundEmails.map((e) => e.id);

				const existingTargetTags = await db.entityTag.findMany({
					where: { entityId: input.targetEntityId },
					select: { tagId: true },
				});
				const existingTagIds = new Set(existingTargetTags.map((t) => t.tagId));
				const newTagIds = source.tags
					.map((t) => t.tagId)
					.filter((id) => !existingTagIds.has(id));

				try {
					await db.$transaction([
						...(threadIds.length > 0
							? [db.emailThread.updateMany({ where: { id: { in: threadIds } }, data: { entityId: input.targetEntityId } })]
							: []),
						...(timelineIds.length > 0
							? [db.timelineEvent.updateMany({ where: { id: { in: timelineIds } }, data: { entityId: input.targetEntityId } })]
							: []),
						...(inboundIds.length > 0
							? [db.inboundEmail.updateMany({ where: { id: { in: inboundIds } }, data: { entityId: input.targetEntityId } })]
							: []),
						...(source.tags.length > 0
							? [db.entityTag.deleteMany({ where: { entityId: input.sourceEntityId } })]
							: []),
						...(newTagIds.length > 0
							? [db.entityTag.createMany({
									data: newTagIds.map((tagId) => ({
										entityId: input.targetEntityId,
										tagId,
									})),
								})]
							: []),
						db.timelineEvent.create({
							data: {
								entityId: input.targetEntityId,
								type: "entity_merged",
								content: `Agent 合并事项「${source.title}」→「${target.title}」：迁移 ${threadIds.length} 封邮件、${timelineIds.length} 条动态${input.reason ? `（${input.reason}）` : ""}`,
								metadata: JSON.stringify({
									sourceEntityId: input.sourceEntityId,
									sourceTitle: source.title,
									threadsMoved: threadIds.length,
									timelineMoved: timelineIds.length,
									reason: input.reason,
									via: "agent",
								}),
							},
						}),
						db.flowEntity.delete({ where: { id: input.sourceEntityId } }),
						db.flowEntity.update({
							where: { id: input.targetEntityId },
							data: { updatedAt: new Date() },
						}),
					]);

					return {
						success: true,
						targetEntityId: input.targetEntityId,
						targetTitle: target.title,
						sourceTitle: source.title,
						threadsMoved: threadIds.length,
						timelineMoved: timelineIds.length,
						tagsMoved: newTagIds.length,
					};
				} catch (err) {
					return {
						error: "合并失败",
						message: err instanceof Error ? err.message : String(err),
					};
				}
			},
		}),

		split_entity_into_subprojects: tool({
			description:
				"当一个 entity 在 extractedFields.subProjects 里被检测出多个独立子项目时，把它「拆分」成多个新 entity。每个子项目变成一个独立 entity（克隆 organizationId、categoryId、来源 thread），原 entity 保留为「母事项」并更新 subProjectsDecision='split'。仅在用户明确同意拆分时调用。",
			inputSchema: z.object({
				entityId: z.string().describe("待拆分的母 entity ID"),
				keepOriginal: z
					.boolean()
					.optional()
					.default(true)
					.describe("是否保留原 entity（默认 true，作为「合并视图」存在）"),
			}),
			execute: async (input: { entityId: string; keepOriginal?: boolean }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: input.entityId },
					include: { threads: { select: { id: true } } },
				});
				if (!entity) {
					return { error: "Entity not found" };
				}

				let fields: Record<string, unknown> = {};
				try {
					fields = entity.extractedFields ? JSON.parse(entity.extractedFields as string) : {};
				} catch {
					fields = {};
				}

				const subProjects = fields.subProjects as
					| Array<{ title: string; summary: string; keywords?: string[] }>
					| undefined;
				if (!subProjects || subProjects.length < 2) {
					return { error: "该 entity 没有 subProjects 候选，无法拆分" };
				}

				const created: { id: string; title: string }[] = [];
				for (const sp of subProjects) {
					const newEntity = await db.flowEntity.create({
						data: {
							organizationId: entity.organizationId,
							type: entity.type,
							categoryId: entity.categoryId,
							title: sp.title,
							status: entity.status,
							aiSummary: sp.summary,
							aiConfidence: entity.aiConfidence,
							extractedFields: JSON.stringify({
								summary: sp.summary,
								keywords: sp.keywords ?? [],
								splitFromEntityId: entity.id,
							}),
						},
					});
					await db.timelineEvent.create({
						data: {
							entityId: newEntity.id,
							type: "entity_split_from",
							content: `从「${entity.title}」拆分而来`,
							metadata: JSON.stringify({ parentEntityId: entity.id, parentTitle: entity.title }),
						},
					});
					created.push({ id: newEntity.id, title: sp.title });
				}

				fields.subProjectsDecision = "split";
				fields.splitChildEntityIds = created.map((c) => c.id);
				await db.flowEntity.update({
					where: { id: entity.id },
					data: { extractedFields: JSON.stringify(fields) },
				});
				await db.timelineEvent.create({
					data: {
						entityId: entity.id,
						type: "action_taken",
						content: `Agent 拆分：${created.length} 个子项目已创建为独立 entity`,
						metadata: JSON.stringify({ via: "agent", action: "split", children: created }),
					},
				});

				return { success: true, parentEntityId: entity.id, children: created };
			},
		}),

		mark_subprojects_decision: tool({
			description:
				"对检测到的多子项目，记录用户的决策为「保持合并」或「只关心某一个」。会更新 extractedFields.subProjectsDecision 并写入 action_taken 时间线事件。不会真的拆分。",
			inputSchema: z.object({
				entityId: z.string(),
				decision: z.enum(["merged", "focused"]).describe("merged=保持合并；focused=只关心某一个子项目"),
				focusedTitle: z
					.string()
					.optional()
					.describe("当 decision=focused 时，指定要关心的子项目 title"),
				note: z.string().optional().describe("用户备注"),
			}),
			execute: async (input: {
				entityId: string;
				decision: "merged" | "focused";
				focusedTitle?: string;
				note?: string;
			}) => {
				const entity = await db.flowEntity.findUnique({ where: { id: input.entityId } });
				if (!entity) {
					return { error: "Entity not found" };
				}
				let fields: Record<string, unknown> = {};
				try {
					fields = entity.extractedFields ? JSON.parse(entity.extractedFields as string) : {};
				} catch {
					fields = {};
				}
				fields.subProjectsDecision = input.decision;
				if (input.focusedTitle) {
					fields.subProjectsFocused = input.focusedTitle;
				}
				await db.flowEntity.update({
					where: { id: entity.id },
					data: { extractedFields: JSON.stringify(fields) },
				});
				await db.timelineEvent.create({
					data: {
						entityId: entity.id,
						type: "action_taken",
						content:
							input.decision === "focused"
								? `保留合并视图，仅关注子项目「${input.focusedTitle}」${input.note ? `（${input.note}）` : ""}`
								: `保持子项目合并展示${input.note ? `（${input.note}）` : ""}`,
						metadata: JSON.stringify({ via: "agent", action: "subprojects_decision", ...input }),
					},
				});
				return { success: true, decision: input.decision };
			},
		}),

		find_merge_candidates: tool({
			description:
				"扫描组织内最近活跃的事项，让 AI 找出「可能本来就是同一件事」的事项组（跨发件人 / 不同主题但同一项目）。用于发现历史遗漏合并。返回候选清单，每组带 entityIds、reason、confidence。⚠️ 本工具只「发现」，不会动数据；要真的合并必须用户确认后再调 merge_entities。典型触发：用户说「帮我看看有没有重复的项目」「按事儿整理一下」「这些项目有没有本来是一个的」。",
			inputSchema: z.object({
				organizationId: z.string(),
				lookbackDays: z
					.number()
					.optional()
					.default(60)
					.describe("回看多少天的活跃事项，默认 60 天"),
				maxEntities: z
					.number()
					.optional()
					.default(40)
					.describe("最多扫描多少条事项，默认 40。事项越多 AI 判断越慢"),
				hint: z
					.string()
					.optional()
					.describe(
						"用户给的额外提示，比如「关注 Blue Sky」「找投资项目相关的」",
					),
			}),
			execute: async (input: {
				organizationId: string;
				lookbackDays?: number;
				maxEntities?: number;
				hint?: string;
			}) => {
				const lookbackDays = input.lookbackDays ?? 60;
				const maxEntities = input.maxEntities ?? 40;
				const cutoff = new Date(
					Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
				);

				const entities = await db.flowEntity.findMany({
					where: {
						organizationId: input.organizationId,
						isFiltered: false,
						updatedAt: { gte: cutoff },
					},
					select: {
						id: true,
						title: true,
						aiSummary: true,
						category: { select: { name: true } },
						threads: {
							select: { subject: true, sender: true },
							orderBy: { receivedAt: "desc" },
							take: 2,
						},
					},
					orderBy: { updatedAt: "desc" },
					take: maxEntities,
				});

				if (entities.length < 2) {
					return {
						scanned: entities.length,
						groups: [],
						note:
							entities.length === 0
								? "近期没有事项可扫描"
								: "只有 1 个事项，没有可合并对象",
					};
				}

				const lines = entities.map((e, idx) => {
					const subjects = e.threads
						.map((t) => t.subject)
						.filter(Boolean)
						.join(" | ");
					const senders = Array.from(
						new Set(e.threads.map((t) => t.sender).filter(Boolean)),
					).join(", ");
					const summary = e.aiSummary?.slice(0, 100) ?? "";
					const cat = e.category?.name ?? "未分类";
					return `[${idx + 1}] id=${e.id}\n  类别: ${cat}\n  标题: ${e.title}${summary ? `\n  摘要: ${summary}` : ""}${subjects ? `\n  近期主题: ${subjects}` : ""}${senders ? `\n  发件人: ${senders}` : ""}`;
				});

				const ResultSchema = z.object({
					groups: z
						.array(
							z.object({
								entityIds: z
									.array(z.string())
									.min(2)
									.describe(
										"应该被合并到一起的事项 id 列表（必须都在输入清单里）",
									),
								primaryEntityId: z
									.string()
									.describe(
										"建议的目标事项（保留下来的那个），通常选最近活跃 / 信息最完整的",
									),
								reason: z
									.string()
									.transform((s) => s.slice(0, 250))
									.describe("为什么觉得这几个是同一件事（业务理由）"),
								confidence: z.number().min(0).max(1),
							}),
						)
						.transform((arr) => arr.slice(0, 10))
						.describe(
							"候选合并组列表。如果都不像，返回空数组。最多返回 10 组",
						),
					notes: z
						.string()
						.optional()
						.transform((s) => (s ? s.slice(0, 200) : undefined))
						.describe("额外说明，比如哪些看起来相关但拿不准的"),
				});

				const result = await safeGenerateObject({
					model: fastModel,
					schema: ResultSchema,
					prompt: `你是邮件项目合并发现器。下面是用户最近 ${lookbackDays} 天活跃的 ${entities.length} 个独立事项。请找出「其实本来就是同一件事，应该合并」的组。${input.hint ? `\n\n用户提示：${input.hint}` : ""}

【判断维度】
1. 同一公司 / 同一产品 / 同一合同号 / 同一客户
2. 同一份月报的不同期次（"4 月报告" 和 "5 月报告" → 都属于「XX 月报」事项）—— 这种 should merge
3. 同一审批 / 同一项目跟进的延续邮件
4. 注意：跨发件人也可能是同一项目（比如同一个项目的不同子公司汇报）

【千万不要合并】
- 不同公司的同类事务（"A 公司月报"和"B 公司月报"）
- 同一公司的不同业务线（"A 公司投资"和"A 公司法务"）
- 不确定的，宁可不合并

【事项清单】
${lines.join("\n\n")}

【输出要求】
- 每组至少 2 个 id，必须都来自上面清单
- primaryEntityId 选最具代表性的那个
- reason 说清楚为什么是同一件事
- confidence ≥ 0.7 才会被采纳
- 如果都不像，返回 groups: []`,
				});

				const validIds = new Set(entities.map((e) => e.id));
				const cleanGroups = (result.groups ?? [])
					.map((g) => ({
						...g,
						entityIds: g.entityIds.filter((id) => validIds.has(id)),
					}))
					.filter(
						(g) =>
							g.entityIds.length >= 2 &&
							validIds.has(g.primaryEntityId) &&
							g.confidence >= 0.7,
					)
					.map((g) => {
						const enriched = g.entityIds.map((id) => {
							const e = entities.find((x) => x.id === id);
							return {
								id,
								title: e?.title ?? "(unknown)",
								category: e?.category?.name ?? "未分类",
							};
						});
						return {
							primaryEntityId: g.primaryEntityId,
							primaryTitle:
								entities.find((e) => e.id === g.primaryEntityId)?.title ??
								"(unknown)",
							entities: enriched,
							reason: g.reason,
							confidence: g.confidence,
						};
					});

				return {
					scanned: entities.length,
					lookbackDays,
					groups: cleanGroups,
					notes: result.notes,
					hint:
						cleanGroups.length === 0
							? "AI 没找到明显的合并候选；如果你心里有具体目标，可以告诉我（比如「检查 Blue Sky 相关」）"
							: `找到 ${cleanGroups.length} 组建议合并。请向用户展示后调用 ask_user 让其逐组确认，确认后用 merge_entities 一次只合一对（target=primaryEntityId, source=其他每个 id）。`,
				};
			},
		}),

		find_related_entities: tool({
			description:
				"给定一个事项 id，从同组织其他事项里找出「跟它最像、可能本来是同一件事」的候选。用于针对单个事项做「找相关」，比 find_merge_candidates 更聚焦。返回带 confidence 的候选清单。⚠️ 只发现，不动数据；合并必须用户确认后再调 merge_entities。",
			inputSchema: z.object({
				entityId: z.string().describe("以这个事项为锚点找相关"),
				maxCandidates: z
					.number()
					.optional()
					.default(30)
					.describe("候选池大小，默认 30"),
				lookbackDays: z.number().optional().default(90),
			}),
			execute: async (input: {
				entityId: string;
				maxCandidates?: number;
				lookbackDays?: number;
			}) => {
				const anchor = await db.flowEntity.findUnique({
					where: { id: input.entityId },
					select: {
						id: true,
						title: true,
						aiSummary: true,
						organizationId: true,
						category: { select: { name: true } },
						threads: {
							select: { subject: true, sender: true, bodyText: true },
							orderBy: { receivedAt: "desc" },
							take: 2,
						},
					},
				});
				if (!anchor) {
					return { error: "Entity not found" };
				}

				const cutoff = new Date(
					Date.now() - (input.lookbackDays ?? 90) * 24 * 60 * 60 * 1000,
				);

				const candidates = await db.flowEntity.findMany({
					where: {
						organizationId: anchor.organizationId,
						isFiltered: false,
						id: { not: anchor.id },
						updatedAt: { gte: cutoff },
					},
					select: {
						id: true,
						title: true,
						aiSummary: true,
						category: { select: { name: true } },
						threads: {
							select: { subject: true, sender: true },
							orderBy: { receivedAt: "desc" },
							take: 2,
						},
					},
					orderBy: { updatedAt: "desc" },
					take: input.maxCandidates ?? 30,
				});

				if (candidates.length === 0) {
					return {
						anchor: { id: anchor.id, title: anchor.title },
						candidates: [],
						note: "组织内没有其他事项",
					};
				}

				const anchorBody =
					anchor.threads
						.map((t) => t.bodyText ?? "")
						.join(" ")
						.slice(0, 600) || "";
				const anchorSubjects = anchor.threads
					.map((t) => t.subject)
					.filter(Boolean)
					.join(" | ");
				const anchorSenders = Array.from(
					new Set(anchor.threads.map((t) => t.sender).filter(Boolean)),
				).join(", ");

				const lines = candidates.map((c, idx) => {
					const subjects = c.threads
						.map((t) => t.subject)
						.filter(Boolean)
						.join(" | ");
					const senders = Array.from(
						new Set(c.threads.map((t) => t.sender).filter(Boolean)),
					).join(", ");
					const summary = c.aiSummary?.slice(0, 100) ?? "";
					const cat = c.category?.name ?? "未分类";
					return `[${idx + 1}] id=${c.id}\n  类别: ${cat}\n  标题: ${c.title}${summary ? `\n  摘要: ${summary}` : ""}${subjects ? `\n  近期主题: ${subjects}` : ""}${senders ? `\n  发件人: ${senders}` : ""}`;
				});

				const ResultSchema = z.object({
					matches: z
						.array(
							z.object({
								entityId: z.string(),
								confidence: z.number().min(0).max(1),
								reason: z.string().transform((s) => s.slice(0, 200)),
							}),
						)
						.transform((arr) => arr.slice(0, 8)),
				});

				const result = await safeGenerateObject({
					model: fastModel,
					schema: ResultSchema,
					prompt: `你要判断哪些已存在的事项跟「锚点事项」其实是同一件事。

【锚点事项】
id: ${anchor.id}
类别: ${anchor.category?.name ?? "未分类"}
标题: ${anchor.title}
摘要: ${anchor.aiSummary?.slice(0, 200) ?? ""}
近期主题: ${anchorSubjects}
发件人: ${anchorSenders}
正文片段: ${anchorBody}

【候选事项清单】（同组织其他事项）
${lines.join("\n\n")}

【判断标准】
1. 同公司/同项目/同合同/同月报系列 → 可能是同一件事
2. 不同公司、不同业务线 → 不要合并
3. 不确定的不要返回（confidence < 0.7 别返回）

返回最多 8 个匹配，按 confidence 降序。如果没有像的，返回 matches: []`,
				});

				const validIds = new Set(candidates.map((c) => c.id));
				const filtered = (result.matches ?? [])
					.filter((m) => validIds.has(m.entityId) && m.confidence >= 0.7)
					.map((m) => {
						const c = candidates.find((x) => x.id === m.entityId);
						return {
							entityId: m.entityId,
							title: c?.title ?? "(unknown)",
							category: c?.category?.name ?? "未分类",
							confidence: m.confidence,
							reason: m.reason,
						};
					});

				return {
					anchor: { id: anchor.id, title: anchor.title },
					scanned: candidates.length,
					candidates: filtered,
					hint:
						filtered.length === 0
							? "没找到明显相关的事项"
							: `找到 ${filtered.length} 个候选。展示给用户后用 ask_user 确认要合并谁，再调 merge_entities(target=锚点 id, source=确认的 id)。`,
				};
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
