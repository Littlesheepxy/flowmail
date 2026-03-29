import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { rejectRequestSchema } from "../types";

export const rejectRequest = protectedProcedure
	.route({
		method: "POST",
		path: "/approvals/{entityId}/reject",
		tags: ["Approvals"],
		summary: "Reject a pending approval request",
	})
	.input(rejectRequestSchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
		});

		if (!entity) throw new ORPCError("NOT_FOUND");
		if (entity.type !== "APPROVAL") throw new ORPCError("BAD_REQUEST");
		if (entity.status !== "pending") throw new ORPCError("BAD_REQUEST");

		const updated = await db.flowEntity.update({
			where: { id: input.entityId },
			data: { status: "rejected" },
		});

		await db.timelineEvent.create({
			data: {
				entityId: input.entityId,
				type: "action_taken",
				content: `Rejected: ${input.reason}`,
				metadata: JSON.stringify({
					action: "rejected",
					reason: input.reason,
				}),
				actorId: context.user.id,
			},
		});

		return { entity: updated, notificationSent: false };
	});
