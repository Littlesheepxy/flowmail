import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { getEntitySchema } from "../types";

export const getEntity = protectedProcedure
	.route({
		method: "GET",
		path: "/flow-entities/{entityId}",
		tags: ["FlowEntities"],
		summary: "Get entity details with timeline",
	})
	.input(getEntitySchema)
	.handler(async ({ input }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			include: {
				assignee: { select: { id: true, name: true, email: true, image: true } },
				threads: {
					orderBy: { receivedAt: "desc" },
					select: {
						id: true,
						subject: true,
						sender: true,
						snippet: true,
						receivedAt: true,
					},
				},
				timeline: {
					orderBy: { createdAt: "asc" },
					include: {
						actor: { select: { id: true, name: true, image: true } },
					},
				},
			},
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND");
		}

		return entity;
	});
