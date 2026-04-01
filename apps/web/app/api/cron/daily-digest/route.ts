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

	const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
	let created = 0;

	const organizations = await db.organization.findMany({
		select: { id: true, name: true },
	});

	for (const org of organizations) {
		const newEntities = await db.flowEntity.count({
			where: {
				organizationId: org.id,
				createdAt: { gte: yesterday },
			},
		});

		const statusChanges = await db.timelineEvent.count({
			where: {
				entity: { organizationId: org.id },
				type: "status_changed",
				createdAt: { gte: yesterday },
			},
		});

		const pendingApprovals = await db.flowEntity.count({
			where: {
				organizationId: org.id,
				type: "APPROVAL",
				status: "pending",
			},
		});

		const upcomingDeadlines = await db.flowEntity.findMany({
			where: {
				organizationId: org.id,
				type: "APPROVAL",
				status: "pending",
			},
			select: { extractedFields: true },
		});

		let nearDeadlineCount = 0;
		const now = Date.now();
		for (const e of upcomingDeadlines) {
			try {
				const fields = e.extractedFields
					? JSON.parse(e.extractedFields)
					: {};
				const deadline = fields.deadline as string | undefined;
				if (deadline) {
					const d = new Date(deadline);
					const hoursLeft = (d.getTime() - now) / (1000 * 60 * 60);
					if (hoursLeft > 0 && hoursLeft <= 72) {
						nearDeadlineCount++;
					}
				}
			} catch {
				// skip
			}
		}

		if (
			newEntities === 0 &&
			statusChanges === 0 &&
			pendingApprovals === 0
		) {
			continue;
		}

		const lines: string[] = [];
		if (pendingApprovals > 0) {
			lines.push(`${pendingApprovals} 项待审批`);
		}
		if (newEntities > 0) {
			lines.push(`昨日新增 ${newEntities} 项`);
		}
		if (statusChanges > 0) {
			lines.push(`${statusChanges} 项状态变更`);
		}
		if (nearDeadlineCount > 0) {
			lines.push(`${nearDeadlineCount} 项即将到期`);
		}

		const result = await triggerNotification({
			organizationId: org.id,
			type: "DAILY_DIGEST",
			title: "每日摘要",
			body: lines.join("；"),
		});
		created += result.created;
	}

	return NextResponse.json({
		ok: true,
		organizations: organizations.length,
		notificationsCreated: created,
	});
}
