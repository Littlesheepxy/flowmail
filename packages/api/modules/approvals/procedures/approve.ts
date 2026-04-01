import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { triggerNotification } from "../../notifications/lib/trigger";
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

		await requireOrgMembershipForResource(entity.organizationId, context.user.id);

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

		triggerNotification({
			organizationId: entity.organizationId,
			type: "STATUS_CHANGED",
			entityId: input.entityId,
			title: `审批通过：${entity.title}`,
			body: `事项「${entity.title}」已被${context.user.name ?? "用户"}审批通过${input.comment ? `，批注：${input.comment}` : ""}`,
		}).catch(() => {});

		return { entity: updated, notificationSent: true };
	});
