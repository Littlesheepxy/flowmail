import { triggerNotification, checkRateLimit, getClientIp, RATE_LIMITS } from "@repo/api";
import { auth } from "@repo/auth";
import { db, getOrganizationMembership } from "@repo/database";
import {
	convertToModelMessages,
	generateObject,
	stepCountIs,
	streamText,
	textModel,
	tool,
	type UIMessage,
} from "@repo/ai";
import { getConnector, processEmail } from "@repo/email-processor";
import { z } from "zod";

export const maxDuration = 60;

// ── System Prompt ─────────────────────────────────────────

interface PageContextInput {
	route?: string;
	organizationId?: string;
	entityId?: string;
	entity?: {
		id: string;
		title: string;
		type: string;
		status: string;
		aiSummary?: string | null;
		extractedFields?: Record<string, unknown>;
		aiConfidence?: number | null;
	};
	timelinePreview?: Array<{ type: string; content: string; createdAt: string }>;
	activeFilters?: { type?: string; status?: string; search?: string };
}

function buildSystemPrompt(ctx: PageContextInput) {
	const contextLines: string[] = [];

	if (ctx.route) {
		contextLines.push(`Page: ${ctx.route}`);
	}
	if (ctx.organizationId) {
		contextLines.push(`Organization: ${ctx.organizationId}`);
	}

	if (ctx.entity) {
		const e = ctx.entity;
		contextLines.push(`Entity: "${e.title}" (${e.type}, status: ${e.status}, id: ${e.id})`);
		if (e.aiSummary) {
			contextLines.push(`AI Summary: ${e.aiSummary}`);
		}
		if (e.aiConfidence != null) {
			contextLines.push(`AI Confidence: ${Math.round(e.aiConfidence * 100)}%`);
		}
		if (e.extractedFields && Object.keys(e.extractedFields).length > 0) {
			contextLines.push(`Extracted Fields: ${JSON.stringify(e.extractedFields)}`);
		}
	} else if (ctx.entityId) {
		contextLines.push(`Entity ID: ${ctx.entityId}`);
	}

	if (ctx.timelinePreview && ctx.timelinePreview.length > 0) {
		contextLines.push("Recent Timeline:");
		for (const ev of ctx.timelinePreview) {
			contextLines.push(`  [${ev.createdAt}] ${ev.type}: ${ev.content}`);
		}
	}

	if (ctx.activeFilters) {
		const parts = Object.entries(ctx.activeFilters)
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}=${v}`);
		if (parts.length > 0) {
			contextLines.push(`Active Filters: ${parts.join(", ")}`);
		}
	}

	const contextBlock = contextLines.length > 0
		? contextLines.join("\n")
		: "当前无特定上下文，用户尚未选择具体事项。";

	return `你是 Flowmail Agent，内嵌在 Flowmail（邮件驱动的业务执行平台）中的 AI 助手。

## 语言要求
**所有回复必须使用简体中文。** 包括：风险因素、建议操作、摘要、分析结论——全部用中文。禁止输出英文段落。

## 当前页面上下文
${contextBlock}

## 工作模式

你有两种工作模式，根据上下文自动切换：

### 模式 A：聚焦模式（上下文中有具体 Entity）
- 上下文已包含实体信息，禁止向用户索要 entity ID、organization ID 等已有信息
- 用户说"分析"、"看看"、"查一下"时，直接用上下文中的 entity ID 调用 get_entity
- 用户说"批准"或"拒绝"时，直接调用对应工具
- 用户问风险时，直接调用 predict_risk

### 模式 B：全局模式（未选中具体 Entity）
- 可以执行跨事项的全局操作：分类检索、收件箱概览、邮件搜索、邮箱管理
- 用户问"有多少待审批"、"今天有什么"时，调用 get_inbox_summary
- 用户说"找所有审批"、"看看报告"时，调用 list_entities 并传入 type 筛选
- 用户说"搜索XXX"时，调用 search_emails 或 list_entities（根据是搜邮件还是搜事项）
- 用户说"同步邮件"时，先 list_connections 找到连接，再 sync_emails
- 用户说"检查分类"、"整理一下"、"有没有分错的"时，调用 batch_reclassify
- 主动引导用户使用全局能力，如概览、检索、分类管理

## 关键行为规则
1. 禁止向用户索要 organization ID 等上下文已有信息，直接使用
2. 简洁、业务导向、全部用中文
3. 工具调用后用 2-3 句中文总结

## 工具列表

**全局工具（无需选中事项）：**
- get_inbox_summary: 收件箱概览（各类型/状态数量、最近活跃）
- list_entities: 分类检索事项（按类型/状态/关键词筛选）
- list_pending_approvals: 列出待审批项
- batch_reclassify: 批量检查分类准确性，列出建议修改的事项
- search_emails: 搜索邮件（按关键词、发件人、主题等）
- list_connections: 列出邮箱连接
- sync_emails: 触发邮件同步
- send_email: 通过已连接邮箱发送邮件

**聚焦工具（需要 Entity 上下文）：**
- get_entity: 获取实体详情
- approve_entity / reject_entity: 审批操作
- predict_risk: AI 风险预测
- get_timeline_diff: 时间线变化分析
- add_note: 添加备注或里程碑
- update_entity_status: 变更实体状态
- update_entity_type: 重新分类事项（APPROVAL / REPORT / ISSUE / FEEDBACK）

## 回复格式

**你只输出纯文本（Markdown）。禁止输出 <ui_block> 标签、JSON 结构或任何 UI 描述。**

UI 卡片由系统根据工具结果自动渲染，你不需要也不应该手动生成 UI。

你的文本职责：
- 调用工具前：简短说明你要做什么（如"我来分析一下风险"）
- 调用工具后：用 2-3 句中文总结关键发现和建议
- 不要在文本中重复卡片里已展示的结构化数据（风险因素列表、截止日期等已在卡片中展示）
- 可以补充卡片中没有的洞察和决策建议`;
}

// ── Tools (AI SDK v5) ─────────────────────────────────────

const agentTools = {
	get_entity: tool({
		description:
			"获取业务事项的完整详情，包括 AI 摘要、抽取字段和时间线。分析事项时首先调用。",
		inputSchema: z.object({
			entityId: z.string().describe("Entity ID"),
		}),
		execute: async (input: { entityId: string }) => {
			const entity = await db.flowEntity.findUnique({
				where: { id: input.entityId },
				include: {
					timeline: { orderBy: { createdAt: "asc" }, take: 10 },
					threads: { select: { subject: true, sender: true, receivedAt: true }, take: 3 },
				},
			});
			if (!entity) { return { error: "Entity not found" }; }
			return {
				id: entity.id,
				title: entity.title,
				type: entity.type,
				status: entity.status,
				aiSummary: entity.aiSummary,
				extractedFields: entity.extractedFields ? JSON.parse(entity.extractedFields) : {},
				aiConfidence: entity.aiConfidence,
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
			const entity = await db.flowEntity.findUnique({ where: { id: input.entityId } });
			if (!entity) { return { error: "Not found" }; }
			if (entity.type !== "APPROVAL" || entity.status !== "pending") {
				return { error: "Entity is not a pending approval" };
			}
			await db.flowEntity.update({ where: { id: input.entityId }, data: { status: "approved" } });
			await db.timelineEvent.create({
				data: {
					entityId: input.entityId,
					type: "action_taken",
					content: `已通过 Agent 批准${input.comment ? `：${input.comment}` : ""}`,
					metadata: JSON.stringify({ action: "approved", comment: input.comment, via: "agent" }),
				},
			});
			triggerNotification({
				organizationId: entity.organizationId,
				type: "STATUS_CHANGED",
				entityId: input.entityId,
				title: `已批准：${entity.title}`,
				body: `审批事项「${entity.title}」已通过 Agent 批准。`,
			}).catch(() => {});
			return { success: true, fromStatus: "pending", toStatus: "approved", title: entity.title };
		},
	}),

	reject_entity: tool({
		description: "拒绝待审批的请求。需要提供拒绝理由。",
		inputSchema: z.object({
			entityId: z.string(),
			reason: z.string().describe("Reason for rejection"),
		}),
		execute: async (input: { entityId: string; reason: string }) => {
			const entity = await db.flowEntity.findUnique({ where: { id: input.entityId } });
			if (!entity) { return { error: "Not found" }; }
			if (entity.type !== "APPROVAL" || entity.status !== "pending") {
				return { error: "Entity is not a pending approval" };
			}
			await db.flowEntity.update({ where: { id: input.entityId }, data: { status: "rejected" } });
			await db.timelineEvent.create({
				data: {
					entityId: input.entityId,
					type: "action_taken",
					content: `已通过 Agent 拒绝：${input.reason}`,
					metadata: JSON.stringify({ action: "rejected", reason: input.reason, via: "agent" }),
				},
			});
			triggerNotification({
				organizationId: entity.organizationId,
				type: "STATUS_CHANGED",
				entityId: input.entityId,
				title: `已拒绝：${entity.title}`,
				body: `审批事项「${entity.title}」已通过 Agent 拒绝：${input.reason}`,
			}).catch(() => {});
			return { success: true, fromStatus: "pending", toStatus: "rejected", title: entity.title };
		},
	}),

	predict_risk: tool({
		description:
			"AI 风险预测。当用户询问风险、截止日期、是否能按时完成时调用。",
		inputSchema: z.object({
			entityId: z.string(),
		}),
		execute: async (input: { entityId: string }) => {
			const entity = await db.flowEntity.findUnique({
				where: { id: input.entityId },
				include: { timeline: { orderBy: { createdAt: "asc" } } },
			});
			if (!entity) { return { error: "Not found" }; }
			if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) {
				return { riskLevel: "unknown", message: "AI key not configured" };
			}

			const fields = entity.extractedFields ? JSON.parse(entity.extractedFields) : {};
			const timelineText = entity.timeline
				.map((e) => `[${e.createdAt.toISOString()}] ${e.type}: ${e.content}`)
				.join("\n");

			const { object } = await generateObject({
				model: textModel,
				schema: z.object({
					riskLevel: z.enum(["low", "medium", "high", "critical"]),
					riskFactors: z.array(z.string()),
					predictedOutcome: z.string(),
					suggestedActions: z.array(z.string()),
					deadlineRisk: z.object({
						hasDeadline: z.boolean(),
						deadline: z.string().nullable(),
						daysRemaining: z.number().nullable(),
						isAtRisk: z.boolean(),
					}),
					confidence: z.number().min(0).max(1),
				}),
				prompt: `请用简体中文分析以下事项的风险。所有文本字段（riskFactors, predictedOutcome, suggestedActions）必须使用中文。

事项："${entity.title}"（类型：${entity.type}，状态：${entity.status}）
字段：${JSON.stringify(fields)}
时间线：${timelineText || "（无）"}
今天：${new Date().toISOString().split("T")[0]}

请评估风险等级、风险因素、预测结果、建议操作和截止日期风险。`,
			});

			return { ...object, entityId: input.entityId };
		},
	}),

	get_timeline_diff: tool({
		description:
			"获取事项时间线的语义变化分析。当用户问发生了什么变化、进展如何时调用。",
		inputSchema: z.object({
			entityId: z.string(),
		}),
		execute: async (input: { entityId: string }) => {
			const entity = await db.flowEntity.findUnique({
				where: { id: input.entityId },
				select: { id: true, type: true, title: true },
			});
			if (!entity) { return { error: "Not found" }; }

			const events = await db.timelineEvent.findMany({
				where: { entityId: input.entityId },
				orderBy: { createdAt: "asc" },
			});
			if (events.length < 2) { return { summary: "Not enough events for diff", changes: [] }; }

			const eventsText = events
				.map((e) => `[${e.createdAt.toISOString()}] ${e.type}: ${e.content}`)
				.join("\n");

			const { object } = await generateObject({
				model: textModel,
				schema: z.object({
					summary: z.string(),
					changes: z.array(z.object({
						field: z.string(),
						before: z.string().nullable(),
						after: z.string().nullable(),
						significance: z.enum(["low", "medium", "high", "critical"]),
					})),
					riskSignals: z.array(z.string()),
					progressDelta: z.number().nullable(),
					recommendation: z.string().nullable(),
				}),
				prompt: `请用简体中文分析以下事项的时间线变化。所有文本字段（summary, field, before, after, riskSignals, recommendation）必须使用中文。

事项："${entity.title}"（类型：${entity.type}）
事件：
${eventsText}

分析：发生了什么变化？有哪些风险信号？进展变化量（-100到100）？有什么建议？`,
			});

			return { ...object, entityId: input.entityId };
		},
	}),

	add_note: tool({
		description: "向事项时间线添加备注或里程碑。",
		inputSchema: z.object({
			entityId: z.string(),
			content: z.string().describe("Note content"),
			type: z.enum(["note", "milestone"]).default("note"),
		}),
		execute: async (input: { entityId: string; content: string; type: "note" | "milestone" }) => {
			const entity = await db.flowEntity.findUnique({
				where: { id: input.entityId },
				select: { id: true, title: true },
			});
			if (!entity) { return { error: "Not found" }; }
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

	update_entity_status: tool({
		description: "更新事项状态。用于状态变更，如调查中、进行中、已阻塞等。",
		inputSchema: z.object({
			entityId: z.string(),
			status: z.string().describe("New status value"),
			reason: z.string().optional().describe("Reason for status change"),
		}),
		execute: async (input: { entityId: string; status: string; reason?: string }) => {
			const entity = await db.flowEntity.findUnique({ where: { id: input.entityId } });
			if (!entity) { return { error: "Not found" }; }
			const previousStatus = entity.status;
			await db.flowEntity.update({ where: { id: input.entityId }, data: { status: input.status } });
			await db.timelineEvent.create({
				data: {
					entityId: input.entityId,
					type: "status_changed",
					content: `状态变更：${previousStatus} → ${input.status}${input.reason ? `（${input.reason}）` : ""}`,
					metadata: JSON.stringify({ previousStatus, newStatus: input.status, reason: input.reason, via: "agent" }),
				},
			});
			triggerNotification({
				organizationId: entity.organizationId,
				type: "STATUS_CHANGED",
				entityId: input.entityId,
				title: `状态变更：${entity.title}`,
				body: `事项「${entity.title}」状态从 ${previousStatus} 变为 ${input.status}`,
			}).catch(() => {});
			return { success: true, fromStatus: previousStatus, toStatus: input.status, title: entity.title };
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

	batch_reclassify: tool({
		description:
			"批量重新分类：AI 自动检查组织内所有事项的分类是否准确，列出建议修改的事项。当用户说'检查分类'、'整理分类'、'有没有分错的' 时调用。",
		inputSchema: z.object({
			organizationId: z.string(),
		}),
		execute: async (input: { organizationId: string }) => {
			const entities = await db.flowEntity.findMany({
				where: { organizationId: input.organizationId },
				select: {
					id: true,
					title: true,
					type: true,
					status: true,
					aiSummary: true,
					aiConfidence: true,
				},
				orderBy: { updatedAt: "desc" },
				take: 30,
			});

			const lowConfidence = entities.filter(
				(e) => e.aiConfidence != null && e.aiConfidence < 0.7,
			);
			const byType: Record<string, number> = {};
			for (const e of entities) {
				byType[e.type] = (byType[e.type] ?? 0) + 1;
			}

			if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) {
				return {
					total: entities.length,
					byType,
					lowConfidenceCount: lowConfidence.length,
					suggestions: lowConfidence.map((e) => ({
						id: e.id,
						title: e.title,
						currentType: e.type,
						confidence: e.aiConfidence,
						reason: "AI 置信度低于 70%",
					})),
				};
			}

			const itemsText = lowConfidence
				.map(
					(e) =>
						`- "${e.title}" (当前: ${e.type}, 置信度: ${Math.round((e.aiConfidence ?? 0) * 100)}%, 摘要: ${e.aiSummary ?? "无"})`,
				)
				.join("\n");

			const { object } = await generateObject({
				model: textModel,
				schema: z.object({
					suggestions: z.array(
						z.object({
							entityId: z.string(),
							title: z.string(),
							currentType: z.string(),
							suggestedType: z
								.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"])
								.nullable(),
							confidence: z.number(),
							reason: z.string(),
						}),
					),
				}),
				prompt: `请用简体中文分析以下事项的分类是否正确。对于分类可能有误的，给出建议的新分类和原因。
如果分类正确，suggestedType 设为 null。

事项列表：
${itemsText || "（无低置信度事项）"}

可用分类：APPROVAL（审批）、REPORT（汇报）、ISSUE（问题）、FEEDBACK（反馈）`,
			});

			return {
				total: entities.length,
				byType,
				lowConfidenceCount: lowConfidence.length,
				suggestions: object.suggestions,
			};
		},
	}),

	list_pending_approvals: tool({
		description: "列出组织内所有待审批的事项。",
		inputSchema: z.object({
			organizationId: z.string(),
		}),
		execute: async (input: { organizationId: string }) => {
			const items = await db.flowEntity.findMany({
				where: { organizationId: input.organizationId, type: "APPROVAL", status: "pending" },
				orderBy: { createdAt: "desc" },
				take: 10,
			});
			return {
				count: items.length,
				items: items.map((e) => ({
					id: e.id,
					title: e.title,
					status: e.status,
					type: e.type,
					aiConfidence: e.aiConfidence,
					updatedAt: e.updatedAt.toISOString(),
				})),
			};
		},
	}),

	list_connections: tool({
		description: "列出当前组织已连接的邮箱账号。当用户问'连了哪些邮箱'、'邮箱状态'时调用。",
		inputSchema: z.object({
			organizationId: z.string(),
		}),
		execute: async (input: { organizationId: string }) => {
			const connections = await db.emailConnection.findMany({
				where: { organizationId: input.organizationId },
				select: {
					id: true,
					provider: true,
					email: true,
					isActive: true,
					lastSyncAt: true,
					authType: true,
				},
				orderBy: { createdAt: "desc" },
			});
			return {
				count: connections.length,
				connections: connections.map((c) => ({
					id: c.id,
					provider: c.provider,
					email: c.email,
					isActive: c.isActive,
					lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
					authType: c.authType,
				})),
			};
		},
	}),

	sync_emails: tool({
		description:
			"触发指定邮箱连接的邮件同步。拉取新邮件并进行 AI 处理。当用户说'同步邮件'、'拉取邮件'、'检查新邮件'时调用。",
		inputSchema: z.object({
			connectionId: z.string().describe("邮箱连接 ID，从 list_connections 结果获取"),
		}),
		execute: async (input: { connectionId: string }) => {
			const connection = await db.emailConnection.findUnique({
				where: { id: input.connectionId },
			});
			if (!connection) {
				return { error: "邮箱连接未找到" };
			}
			if (!connection.isActive) {
				return { error: "该邮箱连接已停用" };
			}

			const connector = getConnector(connection.provider);
			const { emails, newCursor } = await connector.fetchNewEmails(
				{
					provider: connection.provider,
					email: connection.email,
					accessToken: connection.accessToken,
					refreshToken: connection.refreshToken,
					imapHost: connection.imapHost,
					imapPort: connection.imapPort,
					imapPassword: connection.imapPassword,
					authType: connection.authType,
					maxSyncCount: connection.maxSyncCount,
				},
				connection.syncCursor,
			);

			let processed = 0;
			let errors = 0;
			for (const email of emails) {
				const existing = await db.emailThread.findUnique({
					where: {
						connectionId_externalThreadId: {
							connectionId: connection.id,
							externalThreadId: email.externalId,
						},
					},
				});
				if (existing) {
					continue;
				}

				const result = await processEmail({
					threadId: email.threadId ?? email.externalId,
					subject: email.subject,
					sender: email.sender,
					senderEmail: email.senderEmail,
					content: email.content,
					bodyHtml: email.bodyHtml,
					bodyText: email.bodyText,
					toRecipients: email.toRecipients,
					ccRecipients: email.ccRecipients,
					attachments: email.attachments,
					organizationId: connection.organizationId,
					connectionId: connection.id,
					externalThreadId: email.externalId,
					receivedAt: email.receivedAt,
					messageId: email.messageId,
				});
				if (result.success) {
					processed++;
					if (result.entityId) {
						triggerNotification({
							organizationId: connection.organizationId,
							type: "NEW_ENTITY",
							entityId: result.entityId,
							title: `新事项：${email.subject}`,
							body: `来自 ${email.senderEmail} 的邮件已创建新事项（${result.classification ?? "未分类"}）`,
						}).catch(() => {});
					}
				} else {
					errors++;
				}
			}

			await db.emailConnection.update({
				where: { id: connection.id },
				data: {
					lastSyncAt: new Date(),
					...(newCursor ? { syncCursor: newCursor } : {}),
				},
			});

			return {
				email: connection.email,
				provider: connection.provider,
				fetched: emails.length,
				processed,
				errors,
			};
		},
	}),

	send_email: tool({
		description:
			"通过已连接的邮箱发送邮件。当用户说'发邮件'、'回复邮件'、'写封邮件给XXX'时调用。",
		inputSchema: z.object({
			connectionId: z.string().describe("发件邮箱连接 ID"),
			to: z.array(z.string()).describe("收件人邮箱地址列表"),
			cc: z.array(z.string()).optional().describe("抄送邮箱地址列表"),
			subject: z.string().describe("邮件主题"),
			htmlBody: z.string().describe("邮件正文（HTML 格式）"),
			textBody: z.string().optional().describe("纯文本正文（备选）"),
			inReplyTo: z.string().optional().describe("回复的原邮件 Message-ID"),
		}),
		execute: async (input: {
			connectionId: string;
			to: string[];
			cc?: string[];
			subject: string;
			htmlBody: string;
			textBody?: string;
			inReplyTo?: string;
		}) => {
			const connection = await db.emailConnection.findUnique({
				where: { id: input.connectionId },
			});
			if (!connection) {
				return { error: "邮箱连接未找到" };
			}
			if (!connection.accessToken) {
				return { error: "邮箱缺少访问令牌，请重新授权" };
			}

			if (connection.provider === "feishu") {
				const mailboxId = encodeURIComponent(connection.email || "me");
				const toAddrs = input.to.map((addr) => ({ mail_address: addr }));
				const body: Record<string, unknown> = {
					subject: input.subject,
					to: toAddrs,
					body_html: Buffer.from(input.htmlBody).toString("base64"),
				};
				if (input.cc && input.cc.length > 0) {
					body.cc = input.cc.map((addr) => ({ mail_address: addr }));
				}
				const res = await fetch(
					`https://open.feishu.cn/open-apis/mail/v1/user_mailboxes/${mailboxId}/messages`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${connection.accessToken}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify(body),
					},
				);
				const json = (await res.json()) as { code?: number; msg?: string };
				if (json.code !== 0) {
					return { error: `飞书发信失败：${json.msg}` };
				}
				return { success: true, provider: "feishu", from: connection.email, to: input.to, subject: input.subject };
			}

			if (connection.provider === "gmail") {
				const boundary = `boundary_${Date.now()}`;
				const rawEmail = [
					`From: ${connection.email}`,
					`To: ${input.to.join(", ")}`,
					input.cc?.length ? `Cc: ${input.cc.join(", ")}` : "",
					`Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`,
					"MIME-Version: 1.0",
					`Content-Type: multipart/alternative; boundary="${boundary}"`,
					input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : "",
					input.inReplyTo ? `References: ${input.inReplyTo}` : "",
					"",
					`--${boundary}`,
					"Content-Type: text/plain; charset=UTF-8",
					"",
					input.textBody ?? "",
					`--${boundary}`,
					"Content-Type: text/html; charset=UTF-8",
					"",
					input.htmlBody,
					`--${boundary}--`,
				]
					.filter(Boolean)
					.join("\r\n");

				const encodedMessage = Buffer.from(rawEmail)
					.toString("base64")
					.replace(/\+/g, "-")
					.replace(/\//g, "_")
					.replace(/=+$/, "");

				const res = await fetch(
					"https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${connection.accessToken}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ raw: encodedMessage }),
					},
				);

				if (!res.ok) {
					const err = await res.text();
					return { error: `Gmail 发信失败：${err}` };
				}
				return { success: true, provider: "gmail", from: connection.email, to: input.to, subject: input.subject };
			}

			return { error: `暂不支持 ${connection.provider} 发信` };
		},
	}),

	list_entities: tool({
		description:
			"列出组织内的事项，支持按类型、状态筛选和关键词搜索。用于全局查看、分类检索、统计分析。",
		inputSchema: z.object({
			organizationId: z.string(),
			type: z.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"]).optional().describe("按事项类型筛选"),
			status: z.string().optional().describe("按状态筛选，如 pending / approved / rejected / in_progress"),
			search: z.string().optional().describe("按标题关键词搜索"),
			limit: z.number().default(15).describe("最多返回条数"),
		}),
		execute: async (input: {
			organizationId: string;
			type?: string;
			status?: string;
			search?: string;
			limit: number;
		}) => {
			const where: Record<string, unknown> = {
				organizationId: input.organizationId,
			};
			if (input.type) {
				where.type = input.type;
			}
			if (input.status) {
				where.status = input.status;
			}
			if (input.search) {
				where.title = { contains: input.search, mode: "insensitive" };
			}

			const items = await db.flowEntity.findMany({
				where,
				orderBy: { updatedAt: "desc" },
				take: input.limit,
				select: {
					id: true,
					title: true,
					type: true,
					status: true,
					aiConfidence: true,
					aiSummary: true,
					createdAt: true,
					updatedAt: true,
				},
			});

			return {
				count: items.length,
				items: items.map((e) => ({
					id: e.id,
					title: e.title,
					type: e.type,
					status: e.status,
					aiConfidence: e.aiConfidence,
					aiSummary: e.aiSummary ? (e.aiSummary.length > 80 ? `${e.aiSummary.slice(0, 80)}…` : e.aiSummary) : null,
					createdAt: e.createdAt.toISOString(),
					updatedAt: e.updatedAt.toISOString(),
				})),
			};
		},
	}),

	get_inbox_summary: tool({
		description:
			"获取组织收件箱概览统计：各类型数量、各状态数量、最近活跃事项。当用户问'有多少待处理'、'今天有什么'、'收件箱概览'时调用。",
		inputSchema: z.object({
			organizationId: z.string(),
		}),
		execute: async (input: { organizationId: string }) => {
			const entities = await db.flowEntity.findMany({
				where: { organizationId: input.organizationId },
				select: { type: true, status: true, title: true, updatedAt: true },
				orderBy: { updatedAt: "desc" },
			});

			const byType: Record<string, number> = {};
			const byStatus: Record<string, number> = {};
			for (const e of entities) {
				byType[e.type] = (byType[e.type] ?? 0) + 1;
				byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
			}

			const recent = entities.slice(0, 5).map((e) => ({
				title: e.title,
				type: e.type,
				status: e.status,
				updatedAt: e.updatedAt.toISOString(),
			}));

			return {
				total: entities.length,
				byType,
				byStatus,
				recentItems: recent,
			};
		},
	}),

	search_emails: tool({
		description:
			"搜索组织内的邮件。可按关键词、发件人、主题筛选。当用户说'找邮件'、'搜索邮件'、'有没有关于XXX的邮件'时调用。",
		inputSchema: z.object({
			organizationId: z.string(),
			query: z.string().optional().describe("关键词搜索（匹配主题和正文）"),
			sender: z.string().optional().describe("发件人邮箱或名字"),
			limit: z.number().default(10).describe("最多返回条数"),
		}),
		execute: async (input: {
			organizationId: string;
			query?: string;
			sender?: string;
			limit: number;
		}) => {
			const where: Record<string, unknown> = {
				organizationId: input.organizationId,
			};

			if (input.query) {
				where.OR = [
					{ subject: { contains: input.query, mode: "insensitive" } },
					{ bodyText: { contains: input.query, mode: "insensitive" } },
					{ snippet: { contains: input.query, mode: "insensitive" } },
				];
			}
			if (input.sender) {
				where.AND = [
					...(Array.isArray(where.AND) ? (where.AND as unknown[]) : []),
					{
						OR: [
							{ sender: { contains: input.sender, mode: "insensitive" } },
							{ senderName: { contains: input.sender, mode: "insensitive" } },
						],
					},
				];
			}

			const threads = await db.emailThread.findMany({
				where,
				select: {
					id: true,
					subject: true,
					sender: true,
					senderName: true,
					snippet: true,
					receivedAt: true,
					entityId: true,
					entity: { select: { id: true, title: true, type: true, status: true } },
				},
				orderBy: { receivedAt: "desc" },
				take: input.limit,
			});

			return {
				count: threads.length,
				emails: threads.map((t) => ({
					id: t.id,
					subject: t.subject,
					sender: t.senderName ?? t.sender,
					senderEmail: t.sender,
					snippet: t.snippet,
					receivedAt: t.receivedAt.toISOString(),
					entity: t.entity
						? { id: t.entity.id, title: t.entity.title, type: t.entity.type, status: t.entity.status }
						: null,
				})),
			};
		},
	}),
};

// ── Route Handler ─────────────────────────────────────────

export async function POST(req: Request) {
	const ip = getClientIp(req);
	const rl = checkRateLimit(`agent-chat:${ip}`, RATE_LIMITS.agentChat);
	if (!rl.allowed) {
		return new Response(JSON.stringify({ error: "Too many requests" }), {
			status: 429,
			headers: {
				"Content-Type": "application/json",
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
			},
		});
	}

	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	let body: {
		messages: UIMessage[];
		pageContext?: PageContextInput;
		entityId?: string;
		organizationId?: string;
	};
	try {
		body = await req.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { messages, pageContext } = body;

	const ctx: PageContextInput = pageContext ?? {
		entityId: body.entityId,
		organizationId: body.organizationId,
	};

	if (ctx.organizationId) {
		const membership = await getOrganizationMembership(ctx.organizationId, session.user.id);
		if (!membership) {
			return new Response(JSON.stringify({ error: "Forbidden" }), {
				status: 403,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	const result = streamText({
		model: textModel,
		system: buildSystemPrompt(ctx),
		messages: convertToModelMessages(messages),
		tools: agentTools,
		stopWhen: stepCountIs(2),
		prepareStep: ({ stepNumber }) => {
			if (stepNumber > 0) {
				return { toolChoice: "none" as const };
			}
			return undefined;
		},
	});

	return result.toUIMessageStreamResponse();
}
