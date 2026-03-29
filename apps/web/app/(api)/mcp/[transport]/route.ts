import { db } from "@repo/database";
import { createMcpHandler } from "mcp-handler";
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
						metadata: JSON.stringify({ action: "approved", comment }),
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
						metadata: JSON.stringify({ action: "rejected", reason }),
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
	},
	{},
	{
		basePath: "/mcp",
		maxDuration: 60,
	},
);

export { handler as GET, handler as POST, handler as DELETE };
