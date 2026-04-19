import { tool } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";
import {
	suggestCategoriesFromInbox,
	SAMPLE_CATEGORIES,
} from "../lib/category-suggester";

/**
 * Category management tools for the Agent.
 *
 * Flowmail does NOT pre-seed default categories — every organization defines
 * their own. These tools let the user *talk* their categorization system into
 * existence ("帮我加个『投资项目跟进』类别"), or let the AI propose one based
 * on the actual inbox.
 *
 * Workflow recommendation for the planner:
 *   1. User opens an empty inbox (or asks "帮我建分类")
 *   2. Agent calls `suggest_categories_from_inbox` → shows preview to user
 *   3. User confirms → Agent calls `create_categories` (bulk) → done
 *   4. Optional: Agent calls `batch_classify` to apply new categories
 *      retroactively to existing emails
 */
export function createCategoryTools() {
	return {
		list_categories: tool({
			description:
				"列出当前 organization 的所有分类。在添加/修改/删除分类前先调用一次确认现有分类。",
			inputSchema: z.object({
				organizationId: z.string(),
			}),
			execute: async (input: { organizationId: string }) => {
				const categories = await db.category.findMany({
					where: { organizationId: input.organizationId },
					select: {
						id: true,
						name: true,
						slug: true,
						icon: true,
						color: true,
						aiPrompt: true,
						isDefault: true,
						sortOrder: true,
						_count: { select: { entities: true } },
					},
					orderBy: { sortOrder: "asc" },
				});

				return {
					total: categories.length,
					categories: categories.map((c) => ({
						id: c.id,
						name: c.name,
						slug: c.slug,
						icon: c.icon,
						color: c.color,
						aiPrompt: c.aiPrompt,
						isDefault: c.isDefault,
						entityCount: c._count.entities,
					})),
					hint:
						categories.length === 0
							? "还没有任何分类。可以调用 suggest_categories_from_inbox 让 AI 根据邮件建议，或调用 list_sample_categories 看示例。"
							: undefined,
				};
			},
		}),

		list_sample_categories: tool({
			description:
				"列出 Flowmail 内置的几个示例分类（仅供参考，不会自动写入）。当用户问『有什么分类示例可以参考』时调用。",
			inputSchema: z.object({}),
			execute: async () => {
				return {
					samples: SAMPLE_CATEGORIES.map((s) => ({
						name: s.name,
						slug: s.slug,
						icon: s.icon,
						color: s.color,
						aiPrompt: s.aiPrompt,
						description: s.description,
					})),
					hint: "用户挑中后用 create_categories（批量）或 create_category（单个）写入数据库。",
				};
			},
		}),

		suggest_categories_from_inbox: tool({
			description:
				"扫描用户最近的邮件（默认 50 封），用 AI 推荐 3-6 个适合用户工作场景的分类。返回带 name/slug/icon/color/aiPrompt 的建议，用户确认后用 create_categories 批量写入。",
			inputSchema: z.object({
				organizationId: z.string(),
				limit: z.number().min(10).max(100).default(50),
				hint: z
					.string()
					.max(500)
					.optional()
					.describe("用户的偏好提示，例如『我是 VC，关注组合公司动态』"),
			}),
			execute: async (input: {
				organizationId: string;
				limit?: number;
				hint?: string;
			}) => {
				const sampleLimit = input.limit ?? 50;

				const existing = await db.category.findMany({
					where: { organizationId: input.organizationId },
					select: { name: true },
				});

				const entities = await db.flowEntity.findMany({
					where: { organizationId: input.organizationId },
					include: {
						threads: {
							select: {
								subject: true,
								sender: true,
								senderName: true,
								snippet: true,
							},
							orderBy: { receivedAt: "desc" },
							take: 1,
						},
					},
					orderBy: { createdAt: "desc" },
					take: sampleLimit,
				});

				const sample = entities
					.flatMap((e) => e.threads)
					.map((t) => ({
						subject: t.subject ?? "",
						sender: t.senderName ?? t.sender ?? "",
						snippet: t.snippet ?? "",
					}))
					.filter((s) => s.subject || s.snippet);

				if (sample.length === 0) {
					return {
						sampleSize: 0,
						suggestions: [],
						reasoning: "收件箱里还没有邮件。请先收一些邮件，或调用 list_sample_categories 看通用示例。",
					};
				}

				const result = await suggestCategoriesFromInbox({
					emails: sample,
					existingCategoryNames: existing.map((c) => c.name),
					hint: input.hint,
				});

				return {
					sampleSize: sample.length,
					suggestions: result.suggestions,
					reasoning: result.reasoning,
					uncoveredCount: result.uncoveredCount,
					existingCategoryNames: existing.map((c) => c.name),
					hint:
						result.suggestions.length > 0
							? "把建议给用户看一遍，让他确认/调整。确认后调用 create_categories 批量写入。"
							: undefined,
				};
			},
		}),

		create_category: tool({
			description:
				"创建一个新分类。当用户明确说出某个具体分类时使用（如『加个投资项目跟进』）。如果是要批量建议建多个，请用 create_categories。",
			inputSchema: z.object({
				organizationId: z.string(),
				name: z.string().min(1).max(50).describe("中文显示名，简短"),
				slug: z
					.string()
					.min(1)
					.max(50)
					.regex(/^[a-z0-9-]+$/)
					.describe("URL 安全的 slug，全小写+连字符"),
				icon: z
					.string()
					.default("InboxIcon")
					.describe("Lucide icon 名，如 BuildingIcon / TrendingUpIcon"),
				color: z
					.string()
					.regex(/^#[0-9a-fA-F]{6}$/)
					.default("#6366f1"),
				aiPrompt: z
					.string()
					.max(2000)
					.default("")
					.describe("英文分类指令：什么样的邮件该归到这一类（关键词、发件人模式等）"),
			}),
			execute: async (input: {
				organizationId: string;
				name: string;
				slug: string;
				icon?: string;
				color?: string;
				aiPrompt?: string;
			}) => {
				const exists = await db.category.findUnique({
					where: {
						organizationId_slug: {
							organizationId: input.organizationId,
							slug: input.slug,
						},
					},
				});
				if (exists) {
					return {
						error: `slug "${input.slug}" 已存在（${exists.name}）。换个 slug 或用 update_category。`,
						existingId: exists.id,
					};
				}

				const maxOrder = await db.category.aggregate({
					where: { organizationId: input.organizationId },
					_max: { sortOrder: true },
				});

				const cat = await db.category.create({
					data: {
						organizationId: input.organizationId,
						name: input.name,
						slug: input.slug,
						icon: input.icon ?? "InboxIcon",
						color: input.color ?? "#6366f1",
						aiPrompt: input.aiPrompt ?? "",
						sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
					},
				});

				return {
					success: true,
					id: cat.id,
					name: cat.name,
					slug: cat.slug,
				};
			},
		}),

		create_categories: tool({
			description:
				"批量创建多个分类。最常用于『用户接受了 suggest_categories_from_inbox 给出的建议，全部建上』。已存在 slug 的会自动跳过。",
			inputSchema: z.object({
				organizationId: z.string(),
				categories: z
					.array(
						z.object({
							name: z.string().min(1).max(50),
							slug: z
								.string()
								.min(1)
								.max(50)
								.regex(/^[a-z0-9-]+$/),
							icon: z.string().default("InboxIcon"),
							color: z
								.string()
								.regex(/^#[0-9a-fA-F]{6}$/)
								.default("#6366f1"),
							aiPrompt: z.string().max(2000).default(""),
						}),
					)
					.min(1)
					.max(20),
			}),
			execute: async (input: {
				organizationId: string;
				categories: Array<{
					name: string;
					slug: string;
					icon?: string;
					color?: string;
					aiPrompt?: string;
				}>;
			}) => {
				const existing = await db.category.findMany({
					where: { organizationId: input.organizationId },
					select: { slug: true },
				});
				const existingSlugs = new Set(existing.map((c) => c.slug));

				const maxOrder = await db.category.aggregate({
					where: { organizationId: input.organizationId },
					_max: { sortOrder: true },
				});
				let order = (maxOrder._max.sortOrder ?? -1) + 1;

				const created: Array<{ id: string; name: string; slug: string }> = [];
				const skipped: string[] = [];

				for (const cat of input.categories) {
					if (existingSlugs.has(cat.slug)) {
						skipped.push(cat.slug);
						continue;
					}
					const record = await db.category.create({
						data: {
							organizationId: input.organizationId,
							name: cat.name,
							slug: cat.slug,
							icon: cat.icon ?? "InboxIcon",
							color: cat.color ?? "#6366f1",
							aiPrompt: cat.aiPrompt ?? "",
							sortOrder: order++,
						},
						select: { id: true, name: true, slug: true },
					});
					created.push(record);
					existingSlugs.add(cat.slug);
				}

				return {
					createdCount: created.length,
					skippedCount: skipped.length,
					created,
					skipped,
				};
			},
		}),

		update_category: tool({
			description:
				"修改分类的名称、图标、颜色或 aiPrompt（即分类规则）。当用户说『把 XX 分类改成 YY』或『让 XX 分类多匹配一点 ZZ 类型的邮件』时使用。",
			inputSchema: z.object({
				categoryId: z.string(),
				name: z.string().min(1).max(50).optional(),
				icon: z.string().optional(),
				color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
				aiPrompt: z.string().max(2000).optional(),
			}),
			execute: async (input: {
				categoryId: string;
				name?: string;
				icon?: string;
				color?: string;
				aiPrompt?: string;
			}) => {
				const existing = await db.category.findUnique({
					where: { id: input.categoryId },
					select: { name: true },
				});
				if (!existing) {
					return { error: `Category ${input.categoryId} not found` };
				}

				const updated = await db.category.update({
					where: { id: input.categoryId },
					data: {
						...(input.name !== undefined ? { name: input.name } : {}),
						...(input.icon !== undefined ? { icon: input.icon } : {}),
						...(input.color !== undefined ? { color: input.color } : {}),
						...(input.aiPrompt !== undefined ? { aiPrompt: input.aiPrompt } : {}),
					},
				});

				return {
					success: true,
					id: updated.id,
					name: updated.name,
					prevName: existing.name,
				};
			},
		}),

		delete_category: tool({
			description:
				"删除一个分类。被删的分类下的 entity 会变成『未分类』（categoryId=null），不会被删除。慎用：删除前请向用户确认。",
			inputSchema: z.object({
				categoryId: z.string(),
			}),
			execute: async (input: { categoryId: string }) => {
				const existing = await db.category.findUnique({
					where: { id: input.categoryId },
					select: {
						name: true,
						_count: { select: { entities: true } },
					},
				});
				if (!existing) {
					return { error: `Category ${input.categoryId} not found` };
				}

				await db.flowEntity.updateMany({
					where: { categoryId: input.categoryId },
					data: { categoryId: null },
				});

				await db.category.delete({ where: { id: input.categoryId } });

				return {
					success: true,
					deletedName: existing.name,
					affectedEntities: existing._count.entities,
				};
			},
		}),
	};
}
