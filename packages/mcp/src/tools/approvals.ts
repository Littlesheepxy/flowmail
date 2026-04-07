import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@repo/database";
import { z } from "zod/v4";

export function registerApprovalTools(server: McpServer) {
	server.tool(
		"list_pending_approvals",
		"List all pending approval requests for an organization. Use when the user says 'what needs my approval', 'pending approvals', or 'what's waiting for me'.",
		{
			organizationId: z.string().describe("Organization ID"),
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

	server.tool(
		"approve_request",
		"Approve a pending approval request. When the user says 'approve', 'agree', 'pass', or 'OK' for an approval item, call this. Automatically updates status and creates a timeline event. Use list_pending_approvals first to get the entityId.",
		{
			entityId: z.string().describe("Approval entity ID to approve"),
			comment: z
				.string()
				.optional()
				.describe("Optional approval comment"),
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

	server.tool(
		"reject_request",
		"Reject a pending approval request with a required reason. When the user says 'reject', 'deny', or 'refuse' an approval item, call this. Requires a reason.",
		{
			entityId: z.string().describe("Approval entity ID to reject"),
			reason: z.string().describe("Required reason for rejection"),
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
}
