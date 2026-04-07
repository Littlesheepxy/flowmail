import { db } from "@repo/database";
import { NextResponse } from "next/server";

export const maxDuration = 120;

const BATCH_SIZE = 500;

export async function GET(req: Request) {
	const authHeader = req.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const now = new Date();
	let totalDeleted = 0;

	while (true) {
		const expired = await db.emailThread.findMany({
			where: {
				expiresAt: { lt: now },
				entityId: null,
			},
			select: { id: true },
			take: BATCH_SIZE,
		});

		if (expired.length === 0) {
			break;
		}

		const ids = expired.map((t) => t.id);

		await db.emailAttachment.deleteMany({
			where: { threadId: { in: ids } },
		});

		const result = await db.emailThread.deleteMany({
			where: { id: { in: ids } },
		});

		totalDeleted += result.count;
	}

	return NextResponse.json({
		ok: true,
		deleted: totalDeleted,
		timestamp: now.toISOString(),
	});
}
