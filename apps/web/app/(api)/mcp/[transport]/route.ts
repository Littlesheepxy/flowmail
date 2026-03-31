import { db } from "@repo/database";
import { createMcpHandler } from "mcp-handler";
import { generateObject, textModel as mcpTextModel } from "@repo/ai";
import { z } from "zod";

const handler = createMcpHandler(
	(server) => {
		// ── Entity tools ──
		server.registerTool(
			"list_entities",
			{
				title: "List Entities",
				description:
					"List structured business entities (approvals, reports, issues, feedback) for an organization. Use when the user asks to see their inbox, pending items, or recent activity.",
				inputSchema: {
					organizationId: z.string().describe("Organization ID"),
					type: z
						.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"])
						.optional()
						.describe("Filter by entity type"),
					status: z.string().optional().describe("Filter by status"),
					limit: z.number().optional().default(20).describe("Max results"),
				},
			},
			async ({ organizationId, type, status, limit }) => {
				const where: Record<string, unknown> = { organizationId };
				if (type) { where.type = type; }
				if (status) { where.status = status; }

				const entities = await db.flowEntity.findMany({
					where,
					include: { assignee: { select: { name: true, email: true } } },
					orderBy: { updatedAt: "desc" },
					take: limit,
				});

				return {
					content: [
						{ type: "text" as const, text: JSON.stringify(entities, null, 2) },
					],
				};
			},
		);

		server.registerTool(
			"get_entity",
			{
				title: "Get Entity",
				description:
					"Get full details of a business entity including its timeline of events and related email threads.",
				inputSchema: {
					entityId: z.string().describe("Entity ID"),
				},
			},
			async ({ entityId }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					include: {
						assignee: { select: { name: true, email: true } },
						threads: {
							select: {
								subject: true,
								sender: true,
								snippet: true,
								receivedAt: true,
							},
						},
						timeline: {
							orderBy: { createdAt: "asc" },
							include: { actor: { select: { name: true } } },
						},
					},
				});

				if (!entity) {
					return {
						content: [
							{ type: "text" as const, text: "Entity not found" },
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(entity, null, 2),
						},
					],
				};
			},
		);

		server.registerTool(
			"update_entity_status",
			{
				title: "Update Entity Status",
				description:
					"Update the status of a business entity (e.g., mark as completed, in_progress, blocked).",
				inputSchema: {
					entityId: z.string().describe("Entity ID"),
					status: z.string().describe("New status"),
					reason: z.string().optional().describe("Reason for change"),
				},
			},
			async ({ entityId, status, reason }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
				});
				if (!entity) {
					return {
						content: [
							{ type: "text" as const, text: "Entity not found" },
						],
						isError: true,
					};
				}

				const updated = await db.flowEntity.update({
					where: { id: entityId },
					data: { status },
				});

				await db.timelineEvent.create({
					data: {
						entityId,
						type: "status_changed",
						content: `Status changed from ${entity.status} to ${status}${reason ? `: ${reason}` : ""}`,
						metadata: JSON.stringify({
							previousStatus: entity.status,
							newStatus: status,
							reason,
							via: "mcp",
						}),
					},
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ success: true, entity: updated }),
						},
					],
				};
			},
		);

		// ── Approval tools ──
		server.registerTool(
			"list_pending_approvals",
			{
				title: "List Pending Approvals",
				description:
					"List all pending approval requests for an organization. Use when the user says 'what needs my approval' or 'pending approvals'.",
				inputSchema: {
					organizationId: z.string().describe("Organization ID"),
				},
			},
			async ({ organizationId }) => {
				const approvals = await db.flowEntity.findMany({
					where: {
						organizationId,
						type: "APPROVAL",
						status: "pending",
					},
					include: {
						assignee: { select: { name: true, email: true } },
					},
					orderBy: { createdAt: "desc" },
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({
								count: approvals.length,
								approvals,
							}),
						},
					],
				};
			},
		);

		server.registerTool(
			"approve_request",
			{
				title: "Approve Request",
				description:
					'Approve a pending approval request. When the user says "approve", "agree", "pass" for an approval item. Use list_pending_approvals first to get the entityId.',
				inputSchema: {
					entityId: z.string().describe("Approval entity ID"),
					comment: z
						.string()
						.optional()
						.describe("Optional approval comment"),
				},
			},
			async ({ entityId, comment }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
				});
				if (!entity) {
					return {
						content: [
							{ type: "text" as const, text: "Entity not found" },
						],
						isError: true,
					};
				}
				if (entity.type !== "APPROVAL" || entity.status !== "pending") {
					return {
						content: [
							{
								type: "text" as const,
								text: "Entity is not a pending approval",
							},
						],
						isError: true,
					};
				}

				const updated = await db.flowEntity.update({
					where: { id: entityId },
					data: { status: "approved" },
				});

				await db.timelineEvent.create({
					data: {
						entityId,
						type: "action_taken",
						content: `Approved${comment ? `: ${comment}` : ""}`,
						metadata: JSON.stringify({ action: "approved", comment, via: "mcp" }),
					},
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({
								success: true,
								message: `Approval "${updated.title}" has been approved`,
								entity: updated,
							}),
						},
					],
				};
			},
		);

		server.registerTool(
			"reject_request",
			{
				title: "Reject Request",
				description:
					'Reject a pending approval request with a required reason. When the user says "reject", "deny", or "refuse".',
				inputSchema: {
					entityId: z.string().describe("Approval entity ID"),
					reason: z.string().describe("Required reason for rejection"),
				},
			},
			async ({ entityId, reason }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
				});
				if (!entity) {
					return {
						content: [
							{ type: "text" as const, text: "Entity not found" },
						],
						isError: true,
					};
				}
				if (entity.type !== "APPROVAL" || entity.status !== "pending") {
					return {
						content: [
							{
								type: "text" as const,
								text: "Entity is not a pending approval",
							},
						],
						isError: true,
					};
				}

				const updated = await db.flowEntity.update({
					where: { id: entityId },
					data: { status: "rejected" },
				});

				await db.timelineEvent.create({
					data: {
						entityId,
						type: "action_taken",
						content: `Rejected: ${reason}`,
						metadata: JSON.stringify({ action: "rejected", reason, via: "mcp" }),
					},
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({
								success: true,
								message: `Approval "${updated.title}" has been rejected`,
								entity: updated,
							}),
						},
					],
				};
			},
		);

		// ── Report tools ──
		server.registerTool(
			"list_reports",
			{
				title: "List Reports",
				description:
					"List report entities for an organization. Use when the user asks about progress reports, status updates, or team summaries.",
				inputSchema: {
					organizationId: z.string().describe("Organization ID"),
					status: z
						.string()
						.optional()
						.describe("Filter by status"),
				},
			},
			async ({ organizationId, status }) => {
				const where: Record<string, unknown> = {
					organizationId,
					type: "REPORT",
				};
				if (status) { where.status = status; }

				const reports = await db.flowEntity.findMany({
					where,
					include: {
						assignee: { select: { name: true, email: true } },
					},
					orderBy: { updatedAt: "desc" },
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(reports, null, 2),
						},
					],
				};
			},
		);

		server.registerTool(
			"get_report_summary",
			{
				title: "Get Report Summary",
				description:
					"Get AI-generated summary of a report entity. Use when the user asks for a summary of a specific report.",
				inputSchema: {
					entityId: z.string().describe("Report entity ID"),
				},
			},
			async ({ entityId }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					select: {
						id: true,
						title: true,
						aiSummary: true,
						extractedFields: true,
						status: true,
					},
				});

				if (!entity) {
					return {
						content: [
							{ type: "text" as const, text: "Report not found" },
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									title: entity.title,
									status: entity.status,
									summary: entity.aiSummary,
									fields: entity.extractedFields
										? JSON.parse(entity.extractedFields)
										: {},
								},
								null,
								2,
							),
						},
					],
				};
			},
		);

		// ── Email connection tools ──
		server.registerTool(
			"list_email_connections",
			{
				title: "List Email Connections",
				description:
					"List all connected email accounts for an organization.",
				inputSchema: {
					organizationId: z.string().describe("Organization ID"),
				},
			},
			async ({ organizationId }) => {
				const connections = await db.emailConnection.findMany({
					where: { organizationId },
					select: {
						id: true,
						provider: true,
						email: true,
						isActive: true,
						lastSyncAt: true,
					},
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(connections, null, 2),
						},
					],
				};
			},
		);

		// ── Timeline tools ──
		server.registerTool(
			"add_timeline_event",
			{
				title: "Add Timeline Event",
				description:
					"Add a manual event to an entity's timeline. Use when recording milestones, notes, decisions, sent emails, or any significant moment in an entity's lifecycle.",
				inputSchema: {
					entityId: z.string().describe("Entity ID to add event to"),
					type: z
						.enum(["note", "milestone", "action_taken", "status_changed", "ai_summary", "email_sent"])
						.describe("Type of timeline event"),
					content: z.string().min(1).describe("Event content / description"),
					metadata: z
						.record(z.string(), z.unknown())
						.optional()
						.describe("Optional structured metadata (e.g. { deadline, assignee, version })"),
				},
			},
			async ({ entityId, type, content, metadata }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					select: { id: true, title: true },
				});
				if (!entity) {
					return {
						content: [{ type: "text" as const, text: "Entity not found" }],
						isError: true,
					};
				}

				const enrichedMetadata = { ...(metadata ?? {}), via: "mcp" };
				const event = await db.timelineEvent.create({
					data: {
						entityId,
						type,
						content,
						metadata: JSON.stringify(enrichedMetadata),
					},
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({
								success: true,
								message: `Timeline event added to "${entity.title}"`,
								event,
							}),
						},
					],
				};
			},
		);

		server.registerTool(
			"get_timeline_diff",
			{
				title: "Get Timeline Semantic Diff",
				description:
					"Get an AI-powered semantic diff between two points in an entity's timeline. Shows what changed, risk signals, and progress delta. Use when the user asks 'what changed since last week', 'how has this progressed', or 'what's different from before'.",
				inputSchema: {
					entityId: z.string().describe("Entity ID"),
					fromEventId: z
						.string()
						.optional()
						.describe("Starting timeline event ID (defaults to first event)"),
					toEventId: z
						.string()
						.optional()
						.describe("Ending timeline event ID (defaults to latest event)"),
				},
			},
			async ({ entityId, fromEventId, toEventId }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					select: { id: true, type: true, title: true },
				});
				if (!entity) {
					return {
						content: [{ type: "text" as const, text: "Entity not found" }],
						isError: true,
					};
				}

				const allEvents = await db.timelineEvent.findMany({
					where: { entityId },
					orderBy: { createdAt: "asc" },
				});

				if (allEvents.length < 2) {
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({
									summary: "Not enough timeline events for a diff",
									events: allEvents,
								}),
							},
						],
					};
				}

				const fromIdx = fromEventId
					? allEvents.findIndex((e) => e.id === fromEventId)
					: 0;
				const toIdx = toEventId
					? allEvents.findIndex((e) => e.id === toEventId)
					: allEvents.length - 1;

				const rangeEvents = allEvents.slice(
					Math.max(0, fromIdx),
					Math.min(allEvents.length, toIdx + 1),
				);

				const eventsText = rangeEvents
					.map((e) => `[${e.createdAt.toISOString()}] ${e.type}: ${e.content}`)
					.join("\n");

				const hasAiKey = !!process.env.OPENAI_API_KEY;

				if (!hasAiKey) {
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({
									summary: `${rangeEvents.length} events in selected range`,
									events: rangeEvents,
								}),
							},
						],
					};
				}

				const diffSchema = z.object({
					summary: z.string(),
					changes: z.array(
						z.object({
							field: z.string(),
							before: z.string().nullable(),
							after: z.string().nullable(),
							significance: z.enum(["low", "medium", "high", "critical"]),
						}),
					),
					riskSignals: z.array(z.string()),
					progressDelta: z.number().nullable(),
					recommendation: z.string().nullable(),
				});

				const { object: diff } = await generateObject({
					model: mcpTextModel,
					schema: diffSchema,
					prompt: `Analyze these timeline events for entity "${entity.title}" (type: ${entity.type}).

Events:
${eventsText}

Produce a semantic diff: what changed, risk signals, progress delta (-100 to 100), and recommendation.`,
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ ...diff, fromEvent: allEvents[fromIdx], toEvent: allEvents[toIdx] }, null, 2),
						},
					],
				};
			},
		);

		server.registerTool(
			"predict_entity_risk",
			{
				title: "Predict Entity Risk",
				description:
					"AI-powered risk prediction for a business entity. Analyzes timeline history, extracted fields, and current status to predict risk level, deadline risk, and suggest actions. Use when the user asks 'is this at risk', 'will this be done on time', or 'what should I worry about'.",
				inputSchema: {
					entityId: z.string().describe("Entity ID to analyze"),
				},
			},
			async ({ entityId }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					include: {
						timeline: { orderBy: { createdAt: "asc" } },
					},
				});

				if (!entity) {
					return {
						content: [{ type: "text" as const, text: "Entity not found" }],
						isError: true,
					};
				}

				const hasAiKey = !!process.env.OPENAI_API_KEY;

				if (!hasAiKey) {
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({
									riskLevel: "unknown",
									message: "AI prediction requires OPENAI_API_KEY",
								}),
							},
						],
					};
				}

				const fields = entity.extractedFields
					? JSON.parse(entity.extractedFields)
					: {};
				const timelineText = entity.timeline
					.map((e) => `[${e.createdAt.toISOString()}] ${e.type}: ${e.content}`)
					.join("\n");

				const riskSchema = z.object({
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
				});

				const { object: prediction } = await generateObject({
					model: mcpTextModel,
					schema: riskSchema,
					prompt: `Analyze risk for entity "${entity.title}" (${entity.type}, status: ${entity.status}).

Fields: ${JSON.stringify(fields, null, 2)}
Timeline: ${timelineText || "(none)"}
Today: ${new Date().toISOString().split("T")[0]}

Assess risk level, factors, predicted outcome, suggested actions, and deadline risk.`,
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(prediction, null, 2),
						},
					],
				};
			},
		);

		server.registerTool(
			"get_entity_timeline",
			{
				title: "Get Entity Timeline",
				description:
					"Get the full timeline of events for a business entity, ordered chronologically. Shows all email events, AI analysis, status changes, and manual actions. Use when the user asks to see the history or progress of a specific item.",
				inputSchema: {
					entityId: z.string().describe("Entity ID"),
					types: z
						.array(
						z.enum([
							"email_received",
							"email_sent",
							"status_changed",
							"action_taken",
							"ai_summary",
							"milestone",
								"note",
							]),
						)
						.optional()
						.describe("Filter by event types"),
				},
			},
			async ({ entityId, types }) => {
				const entity = await db.flowEntity.findUnique({
					where: { id: entityId },
					select: { id: true, title: true, type: true, status: true },
				});

				if (!entity) {
					return {
						content: [{ type: "text" as const, text: "Entity not found" }],
						isError: true,
					};
				}

				const where: Record<string, unknown> = { entityId };
				if (types && types.length > 0) {
					where.type = { in: types };
				}

				const timeline = await db.timelineEvent.findMany({
					where,
					orderBy: { createdAt: "asc" },
					include: {
						actor: { select: { name: true, email: true } },
					},
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									entity: {
										id: entity.id,
										title: entity.title,
										type: entity.type,
										status: entity.status,
									},
									totalEvents: timeline.length,
									timeline,
								},
								null,
								2,
							),
						},
					],
				};
			},
		);
	},
	{},
	{
		basePath: "/mcp",
		maxDuration: 60,
	},
);

export { handler as GET, handler as POST, handler as DELETE };
