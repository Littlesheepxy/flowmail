import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateCategorySchema } from "../types";

export const updateCategory = protectedProcedure
	.route({
		method: "POST",
		path: "/categories/update",
		tags: ["Categories"],
		summary: "Update a category",
	})
	.input(updateCategorySchema)
	.handler(async ({ input, context }) => {
		const { id, ...data } = input;

		const existing = await db.category.findUniqueOrThrow({ where: { id } });

		await requireOrgMembershipForResource(
			existing.organizationId,
			context.user.id,
		);

		if (existing.isDefault && data.name !== undefined) {
			throw new Error("Cannot rename a default category");
		}

		const category = await db.category.update({
			where: { id },
			data,
		});

		return category;
	});
