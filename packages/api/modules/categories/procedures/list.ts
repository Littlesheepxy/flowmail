import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { listCategoriesSchema } from "../types";

export const listCategories = protectedProcedure
	.route({
		method: "GET",
		path: "/categories",
		tags: ["Categories"],
		summary: "List categories for an organization",
	})
	.input(listCategoriesSchema)
	.handler(async ({ input }) => {
		const categories = await db.category.findMany({
			where: { organizationId: input.organizationId },
			include: {
				_count: { select: { entities: true } },
			},
			orderBy: { sortOrder: "asc" },
		});

		return categories;
	});
