import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { getUnreadCountSchema } from "../types";

export const getUnreadCount = protectedProcedure
	.route({
		method: "GET",
		path: "/notifications/unread-count",
		tags: ["Notifications"],
		summary: "Get unread notification count",
	})
	.input(getUnreadCountSchema)
	.handler(async ({ input, context }) => {
		const count = await db.notification.count({
			where: {
				organizationId: input.organizationId,
				userId: context.user.id,
				isRead: false,
			},
		});

		return { count };
	});
