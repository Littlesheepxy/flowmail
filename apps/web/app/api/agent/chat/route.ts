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
		: "No specific context. User has not selected an entity.";

	return `You are Flowmail Agent, an AI assistant embedded in Flowmail — an AI-native business execution platform that converts emails into structured business items.

You help users manage approvals, progress reports, issues, and feedback extracted from emails.

## Current Page Context
${contextBlock}

## Your Capabilities
You can call tools to:
- Get entity details and timeline
- Approve or reject approval requests
- Predict risk for any entity
- Get semantic diff between timeline points
- Add notes or milestones
- List pending items

## Response Format — BLOCKS PROTOCOL
Your response is rendered as an ordered sequence of BLOCKS.
Each block is either a text paragraph or a structured UI card.

Rules:
1. ALWAYS start with a brief text summary (1-3 sentences) of what you found or did.
2. Then render the appropriate UI card if a tool was called.
3. End with actionable next-step suggestions when relevant.
4. Use Chinese unless the user writes in English.
5. Be concise and business-focused.

To emit a UI card, wrap a JSON object in <ui_block> tags:
<ui_block>{"type":"risk_card","entityId":"xxx",...}</ui_block>

To emit next-step suggestions:
<ui_block>{"type":"suggestions","items":["建议一","建议二"]}</ui_block>

Supported card types: approval_card | report_card | risk_card | timeline_diff | entity_list | action_result | suggestions

Example response pattern:
---
这是一条待审批请求，申请人李明，金额 ¥50,000，用途为市场推广预算。截止日期在 3 天后。

<ui_block>{"type":"approval_card","entityId":"abc","title":"市场推广预算审批","applicant":"李明","amount":"¥50,000","currentStatus":"pending","deadline":"2026-04-02","urgency":"normal"}</ui_block>

<ui_block>{"type":"suggestions","items":["分析这个审批的风险","批准","拒绝，预算超限"]}</ui_block>
---`;
}

// ── Tools (AI SDK v5) ─────────────────────────────────────

const agentTools = {
	get_entity: tool({
		description:
			"Get full details of a business entity including extracted fields, AI summary, and timeline. Call this first to understand the current entity.",
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
		description: "Approve a pending approval request. Only use when user explicitly says to approve.",
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
		description: "Reject a pending approval request. Requires a reason.",
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
			"AI risk prediction for an entity. Use when user asks about risk, deadline, or if something will be done on time.",
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
				prompt: `Analyze risk for "${entity.title}" (${entity.type}, status: ${entity.status}).
Fields: ${JSON.stringify(fields)}
Timeline: ${timelineText || "(none)"}
Today: ${new Date().toISOString().split("T")[0]}
Assess risk level, factors, outcome, actions, and deadline risk.`,
			});

			return { ...object, entityId: input.entityId };
		},
	}),

	get_timeline_diff: tool({
		description:
			"Get semantic diff of what changed in an entity's timeline. Use when user asks what changed, how it progressed, or what happened recently.",
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
				prompt: `Semantic diff for "${entity.title}" (${entity.type}).
Events:\n${eventsText}
What changed? Risk signals? Progress delta (-100 to 100)? Recommendation?`,
			});

			return { ...object, entityId: input.entityId };
		},
	}),

	add_note: tool({
		description: "Add a note or milestone to an entity's timeline.",
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
		description: "Update the status of any entity. Use for status transitions like investigating, in_progress, blocked, etc.",
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
		description: "List all pending approvals for the organization.",
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

	const result = streamText({
		model: textModel,
		system: buildSystemPrompt(ctx),
		messages: convertToModelMessages(messages),
		tools: agentTools,
		stopWhen: stepCountIs(5),
		onFinish: async ({ text }) => {
			console.log("[AgentChat] finish", { entityId: ctx.entityId, textLen: text?.length ?? 0 });
		},
	});

	return result.toUIMessageStreamResponse();
}
