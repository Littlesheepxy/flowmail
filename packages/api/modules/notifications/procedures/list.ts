import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { listNotificationsSchema } from "../types";

export const listNotifications = protectedProcedure
	.route({
		method: "GET",
		path: "/notifications",
		tags: ["Notifications"],
		summary: "List notifications for the current user",
	})
	.input(listNotificationsSchema)
	.handler(async ({ input, context }) => {
		const where: Record<string, unknown> = {
			organizationId: input.organizationId,
			userId: context.user.id,
		};

		if (input.unreadOnly) {
			where.isRead = false;
		}

		if (input.cursor) {
			where.createdAt = { lt: new Date(input.cursor) };
		}

		const notifications = await db.notification.findMany({
			where,
			orderBy: { createdAt: "desc" },
			take: input.limit + 1,
			include: {
				entity: {
					select: { id: true, title: true, type: true, status: true },
				},
			},
		});

		const hasMore = notifications.length > input.limit;
		const items = hasMore ? notifications.slice(0, -1) : notifications;
		const nextCursor = hasMore
			? items[items.length - 1].createdAt.toISOString()
			: undefined;

		return {
			items: items.map((n) => ({
				id: n.id,
				type: n.type,
				title: n.title,
				body: n.body,
				isRead: n.isRead,
				entityId: n.entityId,
				entity: n.entity,
				createdAt: n.createdAt.toISOString(),
			})),
			nextCursor,
		};
	});
