import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateEntityStatusSchema } from "../types";

export const updateEntityStatus = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/{entityId}/status",
		tags: ["FlowEntities"],
		summary: "Update entity status",
	})
	.input(updateEntityStatusSchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND");
		}

		const previousStatus = entity.status;

		const updated = await db.flowEntity.update({
			where: { id: input.entityId },
			data: { status: input.status },
		});

		await db.timelineEvent.create({
			data: {
				entityId: input.entityId,
				type: "status_changed",
				content: `Status changed from ${previousStatus} to ${input.status}${input.reason ? `: ${input.reason}` : ""}`,
				metadata: JSON.stringify({
					previousStatus,
					newStatus: input.status,
					reason: input.reason,
				}),
				actorId: context.user.id,
			},
		});

		return updated;
	});
