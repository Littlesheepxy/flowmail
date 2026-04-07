import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@repo/database";
import { z } from "zod/v4";

export function registerEntityTools(server: McpServer) {
	server.tool(
		"list_entities",
		"List structured business entities (approvals, reports, issues, feedback) for an organization. Use when the user asks to see their inbox, pending items, or recent activity.",
		{
			organizationId: z.string().describe("Organization ID"),
			type: z
				.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"])
				.optional()
				.describe("Filter by entity type"),
			status: z.string().optional().describe("Filter by status"),
			limit: z.number().optional().default(20).describe("Max results"),
		},
		async ({ organizationId, type, status, limit }) => {
			const where: Record<string, unknown> = { organizationId };
			if (type) {
				where.type = type;
			}
			if (status) {
				where.status = status;
			}

			const entities = await db.flowEntity.findMany({
				where,
				include: {
					assignee: {
						select: { name: true, email: true },
					},
				},
				orderBy: { updatedAt: "desc" },
				take: limit,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(entities, null, 2),
					},
				],
			};
		},
	);

	server.tool(
		"get_entity",
		"Get full details of a business entity including its timeline of events. Use when the user asks about a specific approval, report, or item by ID.",
		{
			entityId: z.string().describe("Entity ID to retrieve"),
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
						include: {
							actor: { select: { name: true } },
						},
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

	server.tool(
		"update_entity_status",
		"Update the status of a business entity. Use when the user wants to change the state of an item (e.g., mark as completed, in_progress, blocked).",
		{
			entityId: z.string().describe("Entity ID"),
			status: z.string().describe("New status value"),
			reason: z.string().optional().describe("Reason for status change"),
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
						text: JSON.stringify({
							success: true,
							entity: updated,
						}),
					},
				],
			};
		},
	);
}
