import { db } from "@repo/database";
import { z } from "zod";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";

export const bulkCreateSchema = z.object({
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
				color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
				aiPrompt: z.string().max(2000).default(""),
			}),
		)
		.min(1)
		.max(20),
});

/**
 * Create many categories at once. Used by:
 *   - The "AI suggested categories — accept all" UI flow
 *   - The Agent's `create_category_batch` tool
 * Skips entries whose slug already exists in the org (idempotent).
 */
export const bulkCreateCategories = protectedProcedure
	.route({
		method: "POST",
		path: "/categories/bulk-create",
		tags: ["Categories"],
		summary: "Create multiple categories at once (used by AI suggestions)",
	})
	.input(bulkCreateSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const existing = await db.category.findMany({
			where: { organizationId: input.organizationId },
			select: { slug: true },
		});
		const existingSlugs = new Set(existing.map((c) => c.slug));

		const maxOrder = await db.category.aggregate({
			where: { organizationId: input.organizationId },
			_max: { sortOrder: true },
		});

		const created: Array<{ id: string; name: string; slug: string }> = [];
		const skipped: string[] = [];
		let order = (maxOrder._max.sortOrder ?? -1) + 1;

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
					icon: cat.icon,
					color: cat.color,
					aiPrompt: cat.aiPrompt,
					sortOrder: order++,
				},
				select: { id: true, name: true, slug: true },
			});
			created.push(record);
			existingSlugs.add(cat.slug);
		}

		return {
			created,
			skipped,
			createdCount: created.length,
			skippedCount: skipped.length,
		};
	});
