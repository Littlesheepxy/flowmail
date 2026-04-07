import type { NotificationType } from "@repo/database";
import { db } from "@repo/database";

interface TriggerNotificationParams {
	organizationId: string;
	type: NotificationType;
	entityId?: string;
	title: string;
	body: string;
	excludeUserId?: string;
}

export async function triggerNotification(params: TriggerNotificationParams) {
	const members = await db.member.findMany({
		where: { organizationId: params.organizationId },
		select: { userId: true },
	});

	const userIds = members
		.map((m) => m.userId)
		.filter((id) => id !== params.excludeUserId);

	if (userIds.length === 0) {
		return { created: 0 };
	}

	const result = await db.notification.createMany({
		data: userIds.map((userId) => ({
			organizationId: params.organizationId,
			userId,
			type: params.type,
			title: params.title,
			body: params.body,
			entityId: params.entityId ?? null,
		})),
	});

	return { created: result.count };
}
