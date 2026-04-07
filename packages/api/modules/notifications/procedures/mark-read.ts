import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { markReadSchema } from "../types";

export const markRead = protectedProcedure
	.route({
		method: "POST",
		path: "/notifications/mark-read",
		tags: ["Notifications"],
		summary: "Mark notification(s) as read",
	})
	.input(markReadSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		if (input.markAll) {
			const result = await db.notification.updateMany({
				where: {
					organizationId: input.organizationId,
					userId: context.user.id,
					isRead: false,
				},
				data: { isRead: true },
			});
			return { marked: result.count };
		}

		if (!input.notificationId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "notificationId or markAll required",
			});
		}

		const notification = await db.notification.findUnique({
			where: { id: input.notificationId },
		});

		if (!notification || notification.userId !== context.user.id) {
			throw new ORPCError("NOT_FOUND");
		}

		await db.notification.update({
			where: { id: input.notificationId },
			data: { isRead: true },
		});

		return { marked: 1 };
	});
