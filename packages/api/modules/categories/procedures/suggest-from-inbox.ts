import { suggestCategoriesFromInbox } from "@repo/agent";
import { db } from "@repo/database";
import { z } from "zod";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";

export const suggestFromInboxSchema = z.object({
	organizationId: z.string(),
	limit: z.number().min(10).max(100).default(50),
	hint: z.string().max(500).optional(),
	includeAlreadyClassified: z.boolean().default(true),
});

/**
 * Sample the user's inbox and ask the LLM to propose 3-6 personal categories
 * that match how they actually work. Does NOT persist anything — the caller
 * (Agent or UI) decides which suggestions to keep and creates them via
 * `categories.create` (or via a future `bulkCreate` procedure).
 */
export const suggestFromInbox = protectedProcedure
	.route({
		method: "POST",
		path: "/categories/suggest-from-inbox",
		tags: ["Categories"],
		summary: "Use AI to suggest 3-6 categories based on the user's actual inbox",
	})
	.input(suggestFromInboxSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const existingCategories = await db.category.findMany({
			where: { organizationId: input.organizationId },
			select: { name: true },
			orderBy: { sortOrder: "asc" },
		});

		const entities = await db.flowEntity.findMany({
			where: {
				organizationId: input.organizationId,
				...(input.includeAlreadyClassified ? {} : { categoryId: null }),
			},
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
			take: input.limit,
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
				reasoning: "收件箱里还没有邮件，请先收一些邮件再来分析。",
				uncoveredCount: 0,
				existingCategoryNames: existingCategories.map((c) => c.name),
			};
		}

		const result = await suggestCategoriesFromInbox({
			emails: sample,
			existingCategoryNames: existingCategories.map((c) => c.name),
			hint: input.hint,
		});

		return {
			sampleSize: sample.length,
			suggestions: result.suggestions,
			reasoning: result.reasoning,
			uncoveredCount: result.uncoveredCount,
			existingCategoryNames: existingCategories.map((c) => c.name),
		};
	});
