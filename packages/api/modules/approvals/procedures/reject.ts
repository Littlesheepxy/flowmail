import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { triggerNotification } from "../../notifications/lib/trigger";
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

		if (!entity) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(
			entity.organizationId,
			context.user.id,
		);

		if (entity.type !== "APPROVAL") {
			throw new ORPCError("BAD_REQUEST");
		}
		if (entity.status !== "pending") {
			throw new ORPCError("BAD_REQUEST");
		}

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

		triggerNotification({
			organizationId: entity.organizationId,
			type: "STATUS_CHANGED",
			entityId: input.entityId,
			title: `审批拒绝：${entity.title}`,
			body: `事项「${entity.title}」已被${context.user.name ?? "用户"}拒绝，原因：${input.reason}`,
		}).catch(() => {});

		return { entity: updated, notificationSent: true };
	});
