import { db } from "@repo/database";
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
	.handler(async ({ input }) => {
		const where: Record<string, unknown> = {
			organizationId: input.organizationId,
		};
		if (input.type) where.type = input.type;
		if (input.status) where.status = input.status;

		const [entities, total] = await Promise.all([
			db.flowEntity.findMany({
				where,
				include: {
					assignee: { select: { id: true, name: true, email: true, image: true } },
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
