import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { createCategorySchema } from "../types";

export const createCategory = protectedProcedure
	.route({
		method: "POST",
		path: "/categories",
		tags: ["Categories"],
		summary: "Create a new category",
	})
	.input(createCategorySchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);
		const maxOrder = await db.category.aggregate({
			where: { organizationId: input.organizationId },
			_max: { sortOrder: true },
		});

		const category = await db.category.create({
			data: {
				organizationId: input.organizationId,
				name: input.name,
				slug: input.slug,
				icon: input.icon,
				color: input.color,
				aiPrompt: input.aiPrompt,
				sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
			},
		});

		return category;
	});
