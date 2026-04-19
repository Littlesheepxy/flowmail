import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";
import { VIEW_COMPONENT_DOCS, ViewSpecSchema } from "../views/schema";

/**
 * 自定义视图工具：让 Agent 用预定义的「积木」（block）拼出 entity / category 的自定义 Tab。
 *
 * 工作流：
 * 1. Agent 收到用户意图（如「给这个项目做个月度汇报视图」）
 * 2. 调用 list_view_components 看可用的 block 类型 + props
 * 3. 调用 create_view 写入数据库（此处会自动校验 spec 形状）
 * 4. 用户在 EntityDetail 看到新 tab
 *
 * 视图作用域：
 * - entity 级：只这个 entity 可见（{ entityId }）
 * - category 级：该 category 下所有 entity 可见（{ categoryId }，模板）
 */
export function createViewTools() {
	return {
		list_view_components: tool({
			description:
				"列出所有可用的视图组件（block）类型及它们的 props。在创建/修改自定义视图前必须先调用一次，了解可用积木。",
			inputSchema: z.object({}),
			execute: async () => {
				return {
					components: VIEW_COMPONENT_DOCS,
					notes: [
						"创建视图前先想好用户想看什么，再选 1-5 个合适的 block 拼接",
						"text 长度不要太大；kpi_cards.items 控制在 4 个内最美观",
						"todo_list source=auto 时前端自动从 entity 字段聚合，items 留空即可",
						"timeline groupBy=month 适合看多月汇报；none 时是普通时间线",
						"quick_actions.actions[].prompt 是用户点按钮后会发给 Agent 的 prompt，要写清楚",
					],
				};
			},
		}),

		list_views: tool({
			description: "列出某个 entity 或 category 下所有自定义视图。返回视图标题和 viewId。",
			inputSchema: z.object({
				entityId: z.string().optional(),
				categoryId: z.string().optional(),
			}),
			execute: async (input: { entityId?: string; categoryId?: string }) => {
				if (!input.entityId && !input.categoryId) {
					return { error: "必须提供 entityId 或 categoryId" };
				}
				const views = await db.entityView.findMany({
					where: {
						...(input.entityId ? { entityId: input.entityId } : {}),
						...(input.categoryId ? { categoryId: input.categoryId } : {}),
					},
					select: {
						id: true,
						title: true,
						icon: true,
						entityId: true,
						categoryId: true,
						createdAt: true,
						updatedAt: true,
					},
					orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
				});
				return { views, count: views.length };
			},
		}),

		get_view: tool({
			description: "获取视图详情（含 spec.blocks）。修改视图前先调用此工具看现有结构。",
			inputSchema: z.object({ viewId: z.string() }),
			execute: async (input: { viewId: string }) => {
				const view = await db.entityView.findUnique({ where: { id: input.viewId } });
				if (!view) {
					return { error: "View not found" };
				}
				let spec: unknown;
				try {
					spec = JSON.parse(view.spec);
				} catch {
					spec = { blocks: [] };
				}
				return {
					id: view.id,
					title: view.title,
					icon: view.icon,
					entityId: view.entityId,
					categoryId: view.categoryId,
					spec,
				};
			},
		}),

		create_view: tool({
			description:
				"创建一个自定义视图（成为 entity / category 的新 Tab）。spec 是 { blocks: [...] }，blocks 类型必须从 list_view_components 返回的列表中选取。entityId 和 categoryId 至少提供一个。",
			inputSchema: z.object({
				title: z.string().max(60).describe("Tab 显示标题，简短"),
				icon: z.string().optional().describe("Lucide icon 名，默认 LayoutDashboardIcon"),
				entityId: z.string().optional().describe("作用于单个 entity（独享）"),
				categoryId: z.string().optional().describe("作用于整个 category（模板）"),
				spec: z
					.object({
						blocks: z.array(z.record(z.string(), z.unknown())),
					})
					.describe("{ blocks: [{type, ...props}, ...] } 形状"),
				isPinned: z.boolean().optional(),
			}),
			execute: async (input: {
				title: string;
				icon?: string;
				entityId?: string;
				categoryId?: string;
				spec: { blocks: Record<string, unknown>[] };
				isPinned?: boolean;
			}) => {
				if (!input.entityId && !input.categoryId) {
					return { error: "必须提供 entityId 或 categoryId" };
				}

				const parsed = ViewSpecSchema.safeParse(input.spec);
				if (!parsed.success) {
					return {
						error: "spec 格式不合法",
						details: parsed.error.issues.slice(0, 5).map((i: { path: PropertyKey[]; message: string }) => ({
							path: i.path.join("."),
							message: i.message,
						})),
						hint: "先调用 list_view_components 看可用 block 和 props",
					};
				}

				let organizationId: string | undefined;
				if (input.entityId) {
					const e = await db.flowEntity.findUnique({
						where: { id: input.entityId },
						select: { organizationId: true },
					});
					if (!e) {
						return { error: `Entity ${input.entityId} not found` };
					}
					organizationId = e.organizationId;
				} else if (input.categoryId) {
					const c = await db.category.findUnique({
						where: { id: input.categoryId },
						select: { organizationId: true },
					});
					if (!c) {
						return { error: `Category ${input.categoryId} not found` };
					}
					organizationId = c.organizationId;
				}

				if (!organizationId) {
					return { error: "无法解析 organizationId" };
				}

				const view = await db.entityView.create({
					data: {
						organizationId,
						entityId: input.entityId,
						categoryId: input.categoryId,
						title: input.title,
						icon: input.icon ?? "LayoutDashboardIcon",
						spec: JSON.stringify(parsed.data),
						isPinned: input.isPinned ?? false,
					},
				});

				return {
					success: true,
					viewId: view.id,
					title: view.title,
					blockCount: parsed.data.blocks.length,
				};
			},
		}),

		update_view: tool({
			description:
				"修改已有视图的 title / icon / spec / isPinned。spec 必须传完整的 { blocks: [...] }（不是增量），调用前先 get_view 拿现有 blocks 再改。",
			inputSchema: z.object({
				viewId: z.string(),
				title: z.string().max(60).optional(),
				icon: z.string().optional(),
				spec: z
					.object({
						blocks: z.array(z.record(z.string(), z.unknown())),
					})
					.optional(),
				isPinned: z.boolean().optional(),
			}),
			execute: async (input: {
				viewId: string;
				title?: string;
				icon?: string;
				spec?: { blocks: Record<string, unknown>[] };
				isPinned?: boolean;
			}) => {
				const view = await db.entityView.findUnique({ where: { id: input.viewId } });
				if (!view) {
					return { error: "View not found" };
				}

				const data: Record<string, unknown> = {};
				if (input.title !== undefined) {
					data.title = input.title;
				}
				if (input.icon !== undefined) {
					data.icon = input.icon;
				}
				if (input.isPinned !== undefined) {
					data.isPinned = input.isPinned;
				}
				if (input.spec !== undefined) {
					const parsed = ViewSpecSchema.safeParse(input.spec);
					if (!parsed.success) {
						return {
							error: "spec 格式不合法",
							details: parsed.error.issues.slice(0, 5).map((i: { path: PropertyKey[]; message: string }) => ({
								path: i.path.join("."),
								message: i.message,
							})),
						};
					}
					data.spec = JSON.stringify(parsed.data);
				}

				const updated = await db.entityView.update({
					where: { id: input.viewId },
					data,
				});

				return { success: true, viewId: updated.id, title: updated.title };
			},
		}),

		delete_view: tool({
			description: "删除自定义视图。仅删视图本身，不影响 entity/邮件/时间线。不可逆，必要时先用 ask_user 确认。",
			inputSchema: z.object({ viewId: z.string() }),
			execute: async (input: { viewId: string }) => {
				const view = await db.entityView.findUnique({
					where: { id: input.viewId },
					select: { id: true, title: true },
				});
				if (!view) {
					return { error: "View not found" };
				}
				await db.entityView.delete({ where: { id: input.viewId } });
				return { success: true, deletedTitle: view.title };
			},
		}),
	};
}
