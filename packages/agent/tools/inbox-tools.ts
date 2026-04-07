import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";

export function createInboxTools() {
	return {
		get_inbox_summary: tool({
			description:
				"获取组织收件箱概览统计：各类型数量、各状态数量、最近活跃事项。",
			inputSchema: z.object({
				organizationId: z.string(),
			}),
			execute: async (input: { organizationId: string }) => {
				const entities = await db.flowEntity.findMany({
					where: { organizationId: input.organizationId },
					select: {
						type: true,
						status: true,
						title: true,
						updatedAt: true,
					},
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

		list_entities: tool({
			description: "列出组织内的事项，支持按类型、状态筛选和关键词搜索。",
			inputSchema: z.object({
				organizationId: z.string(),
				type: z
					.enum(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"])
					.optional()
					.describe("按事项类型筛选"),
				status: z.string().optional().describe("按状态筛选"),
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
					where.title = {
						contains: input.search,
						mode: "insensitive",
					};
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
						aiSummary: e.aiSummary
							? e.aiSummary.length > 80
								? `${e.aiSummary.slice(0, 80)}…`
								: e.aiSummary
							: null,
						createdAt: e.createdAt.toISOString(),
						updatedAt: e.updatedAt.toISOString(),
					})),
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
					where: {
						organizationId: input.organizationId,
						type: "APPROVAL",
						status: "pending",
					},
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
}
