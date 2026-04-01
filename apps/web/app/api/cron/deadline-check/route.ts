import { triggerNotification } from "@repo/api";
import { db } from "@repo/database";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(req: Request) {
	const authHeader = req.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const now = new Date();
	let created = 0;

	const pendingApprovals = await db.flowEntity.findMany({
		where: {
			type: "APPROVAL",
			status: "pending",
		},
		select: {
			id: true,
			title: true,
			organizationId: true,
			extractedFields: true,
			createdAt: true,
		},
	});

	for (const entity of pendingApprovals) {
		let fields: Record<string, unknown> = {};
		try {
			fields = entity.extractedFields
				? JSON.parse(entity.extractedFields)
				: {};
		} catch {
			continue;
		}

		const deadline = fields.deadline as string | undefined;
		if (!deadline) {
			continue;
		}

		const deadlineDate = new Date(deadline);
		if (Number.isNaN(deadlineDate.getTime())) {
			continue;
		}

		const hoursRemaining =
			(deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

		const existing = await db.notification.findFirst({
			where: {
				entityId: entity.id,
				type: hoursRemaining <= 0 ? "DEADLINE_OVERDUE" : "DEADLINE_WARNING",
				createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
			},
		});

		if (existing) {
			continue;
		}

		if (hoursRemaining <= 0) {
			const result = await triggerNotification({
				organizationId: entity.organizationId,
				type: "DEADLINE_OVERDUE",
				entityId: entity.id,
				title: `已过期：${entity.title}`,
				body: `审批事项「${entity.title}」已超过截止日期（${deadline}），请尽快处理。`,
			});
			created += result.created;
		} else if (hoursRemaining <= 48) {
			const label =
				hoursRemaining <= 24
					? "剩余不到 24 小时"
					: "剩余不到 48 小时";
			const result = await triggerNotification({
				organizationId: entity.organizationId,
				type: "DEADLINE_WARNING",
				entityId: entity.id,
				title: `截止提醒：${entity.title}`,
				body: `审批事项「${entity.title}」${label}（截止：${deadline}），请及时处理。`,
			});
			created += result.created;
		}
	}

	const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
	const staleApprovals = await db.flowEntity.findMany({
		where: {
			type: "APPROVAL",
			status: "pending",
			createdAt: { lte: threeDaysAgo },
		},
		select: {
			id: true,
			title: true,
			organizationId: true,
			createdAt: true,
		},
	});

	for (const entity of staleApprovals) {
		const existing = await db.notification.findFirst({
			where: {
				entityId: entity.id,
				type: "APPROVAL_TIMEOUT",
				createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
			},
		});

		if (existing) {
			continue;
		}

		const daysSinceCreation = Math.floor(
			(now.getTime() - entity.createdAt.getTime()) / (1000 * 60 * 60 * 24),
		);

		const result = await triggerNotification({
			organizationId: entity.organizationId,
			type: "APPROVAL_TIMEOUT",
			entityId: entity.id,
			title: `审批超时：${entity.title}`,
			body: `审批事项「${entity.title}」已等待 ${daysSinceCreation} 天未处理，请关注。`,
		});
		created += result.created;
	}

	return NextResponse.json({
		ok: true,
		checked: pendingApprovals.length,
		staleChecked: staleApprovals.length,
		notificationsCreated: created,
	});
}
