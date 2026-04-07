import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@repo/database";
import { z } from "zod/v4";

export function registerReportTools(server: McpServer) {
	server.tool(
		"list_reports",
		"List report entities for an organization. Use when the user asks about weekly reports, progress updates, or team status.",
		{
			organizationId: z.string().describe("Organization ID"),
			status: z
				.string()
				.optional()
				.describe("Filter by status (in_progress, completed, blocked)"),
		},
		async ({ organizationId, status }) => {
			const where: Record<string, unknown> = {
				organizationId,
				type: "REPORT",
			};
			if (status) {
				where.status = status;
			}

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
						text: JSON.stringify({
							count: reports.length,
							reports,
						}),
					},
				],
			};
		},
	);

	server.tool(
		"get_report_summary",
		"Get the AI-generated summary for a report entity. Use when the user asks to summarize a specific report or wants a quick overview.",
		{
			entityId: z.string().describe("Report entity ID"),
		},
		async ({ entityId }) => {
			const entity = await db.flowEntity.findUnique({
				where: { id: entityId },
				select: {
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
						text:
							entity.aiSummary ??
							`No AI summary available for "${entity.title}". Extracted fields: ${entity.extractedFields}`,
					},
				],
			};
		},
	);
}
