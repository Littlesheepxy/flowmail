import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { listEntitiesSchema } from "../types";

export const listEntities = protectedProcedure
	.route({
		method: "GET",
		path: "/flow-entities",
		tags: ["FlowEntities"],
		summary: "List flow entities for an organization",
	})
	.input(listEntitiesSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);
		const where: Record<string, unknown> = {
			organizationId: input.organizationId,
		};
		if (input.type) {
			where.type = input.type;
		}
		if (input.categoryId) {
			where.categoryId = input.categoryId;
		}
		if (input.categorySlug) {
			const cat = await db.category.findFirst({
				where: {
					organizationId: input.organizationId,
					slug: input.categorySlug,
				},
				select: { id: true },
			});
			if (cat) {
				where.categoryId = cat.id;
			}
		}
		if (input.status) {
			where.status = input.status;
		}

		if (input.categorySlug === "noise") {
			where.isFiltered = true;
		} else if (!input.includeFiltered) {
			where.isFiltered = false;
		}

		const [entities, total] = await Promise.all([
			db.flowEntity.findMany({
				where,
				include: {
					assignee: { select: { id: true, name: true, email: true, image: true } },
					category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
					tags: {
						include: {
							tag: { select: { id: true, name: true, color: true } },
						},
					},
					_count: { select: { timeline: true, threads: true } },
				},
				orderBy: { updatedAt: "desc" },
				take: input.limit,
				skip: input.offset,
			}),
			db.flowEntity.count({ where }),
		]);

		return { entities, total };
	});
