import { db } from "@repo/database";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 30;

const callbackSchema = z.object({
	entityId: z.string(),
	taskId: z.string().optional(),
	status: z.enum(["success", "error", "partial"]),
	summary: z.string(),
	actions: z
		.array(
			z.object({
				tool: z.string(),
				status: z.enum(["success", "error", "skipped"]),
				result: z.record(z.unknown()).optional(),
			}),
		)
		.optional(),
});

export async function POST(req: Request) {
	const authHeader = req.headers.get("authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: z.infer<typeof callbackSchema>;
	try {
		const raw = await req.json();
		body = callbackSchema.parse(raw);
	} catch {
		return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
	}

	const entity = await db.flowEntity.findUnique({
		where: { id: body.entityId },
		select: { id: true, title: true },
	});

	if (!entity) {
		return NextResponse.json({ error: "Entity not found" }, { status: 404 });
	}

	const statusEmoji = body.status === "success" ? "✅" : body.status === "error" ? "❌" : "⚠️";
	const actionsLog = body.actions
		?.map((a) => `  ${a.status === "success" ? "✓" : "✗"} ${a.tool}`)
		.join("\n");

	await db.timelineEvent.create({
		data: {
			entityId: body.entityId,
			type: "action_taken",
			content: `${statusEmoji} Agent 执行结果：${body.summary}${actionsLog ? "\n" + actionsLog : ""}`,
			metadata: JSON.stringify({
				via: "openclaw",
				taskId: body.taskId,
				status: body.status,
				actions: body.actions,
			}),
		},
	});

	return NextResponse.json({
		success: true,
		message: `Callback recorded for "${entity.title}"`,
	});
}
