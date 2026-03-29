import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { approveRequestSchema } from "../types";

export const approveRequest = protectedProcedure
	.route({
		method: "POST",
		path: "/approvals/{entityId}/approve",
		tags: ["Approvals"],
		summary: "Approve a pending approval request",
	})
	.input(approveRequestSchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
		});

		if (!entity) throw new ORPCError("NOT_FOUND");
		if (entity.type !== "APPROVAL") throw new ORPCError("BAD_REQUEST");
		if (entity.status !== "pending") throw new ORPCError("BAD_REQUEST");

		const updated = await db.flowEntity.update({
			where: { id: input.entityId },
			data: { status: "approved" },
		});

		await db.timelineEvent.create({
			data: {
				entityId: input.entityId,
				type: "action_taken",
				content: `Approved${input.comment ? `: ${input.comment}` : ""}`,
				metadata: JSON.stringify({
					action: "approved",
					comment: input.comment,
				}),
				actorId: context.user.id,
			},
		});

		return { entity: updated, notificationSent: false };
	});
