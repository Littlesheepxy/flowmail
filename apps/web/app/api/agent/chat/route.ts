import { db } from "@repo/database";
import {
	convertToModelMessages,
	generateObject,
	stepCountIs,
	streamText,
	textModel,
	tool,
	type UIMessage,
} from "@repo/ai";
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

## 关键行为规则
1. 上下文已包含实体信息，禁止向用户索要 entity ID、organization ID 等已有信息。
2. 用户说"分析"、"看看"、"查一下"时，直接用上下文中的 entity ID 调用 get_entity，无需确认。
3. 用户说"批准"或"拒绝"时，直接调用对应工具。
4. 用户问风险时，直接调用 predict_risk。
5. 简洁、业务导向、用中文。

## 工具列表
- get_entity: 获取实体详情（用上下文中的 entity ID）
- approve_entity / reject_entity: 审批操作
- predict_risk: AI 风险预测
- get_timeline_diff: 时间线变化分析
- add_note: 添加备注或里程碑
- update_entity_status: 变更实体状态
- list_pending_approvals: 列出待审批项（用上下文中的 organization ID）

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
			return { success: true, fromStatus: previousStatus, toStatus: input.status, title: entity.title };
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
};

// ── Route Handler ─────────────────────────────────────────

export async function POST(req: Request) {
	const body = await req.json() as {
		messages: UIMessage[];
		pageContext?: PageContextInput;
		entityId?: string;
		organizationId?: string;
	};
	const { messages, pageContext } = body;

	const ctx: PageContextInput = pageContext ?? {
		entityId: body.entityId,
		organizationId: body.organizationId,
	};

	console.log("[AgentChat] request context", {
		entityId: ctx.entityId,
		hasEntity: !!ctx.entity,
		organizationId: ctx.organizationId,
		route: ctx.route,
	});

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
		onFinish: async ({ text, toolCalls, finishReason }) => {
			console.log("[AgentChat] finish", {
				entityId: ctx.entityId,
				textLen: text?.length ?? 0,
				finishReason,
				toolCallCount: toolCalls?.length ?? 0,
				toolNames: toolCalls?.map((tc: { toolName: string }) => tc.toolName),
			});
		},
	});

	return result.toUIMessageStreamResponse();
}
