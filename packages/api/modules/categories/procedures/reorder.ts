import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { reorderCategoriesSchema } from "../types";

export const reorderCategories = protectedProcedure
	.route({
		method: "POST",
		path: "/categories/reorder",
		tags: ["Categories"],
		summary: "Reorder categories by providing ordered IDs",
	})
	.input(reorderCategoriesSchema)
	.handler(async ({ input }) => {
		await db.$transaction(
			input.orderedIds.map((id, index) =>
				db.category.update({
					where: { id },
					data: { sortOrder: index },
				}),
			),
		);

		return { success: true };
	});
