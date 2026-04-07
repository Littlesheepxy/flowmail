import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { deleteCategorySchema } from "../types";

export const deleteCategory = protectedProcedure
	.route({
		method: "POST",
		path: "/categories/delete",
		tags: ["Categories"],
		summary: "Delete a category (non-default only)",
	})
	.input(deleteCategorySchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);
		const existing = await db.category.findUniqueOrThrow({
			where: { id: input.id },
		});

		if (existing.isDefault) {
			throw new Error("Cannot delete a default category");
		}

		let uncategorized = await db.category.findFirst({
			where: {
				organizationId: input.organizationId,
				slug: "uncategorized",
			},
		});

		if (!uncategorized) {
			uncategorized = await db.category.create({
				data: {
					organizationId: input.organizationId,
					name: "未分类",
					slug: "uncategorized",
					icon: "InboxIcon",
					color: "#94a3b8",
					aiPrompt: "",
					sortOrder: 999,
					isDefault: true,
				},
			});
		}

		await db.flowEntity.updateMany({
			where: { categoryId: input.id },
			data: { categoryId: uncategorized.id },
		});

		await db.category.delete({ where: { id: input.id } });

		return { success: true };
	});
