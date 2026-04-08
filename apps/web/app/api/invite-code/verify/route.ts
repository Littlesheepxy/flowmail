import { isValidInviteCode } from "@repo/auth/server/invite-codes";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
	code: z.string().min(1),
});

// Simple in-process rate limiter: max 10 attempts per IP per minute.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const entry = attempts.get(ip);
	if (!entry || now > entry.resetAt) {
		attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return false;
	}
	entry.count += 1;
	return entry.count > MAX_ATTEMPTS;
}

export async function POST(request: NextRequest) {
	const ip =
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		"unknown";

	if (isRateLimited(ip)) {
		return NextResponse.json({ ok: false }, { status: 429 });
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ ok: false }, { status: 400 });
	}

	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ ok: false }, { status: 400 });
	}

	if (!isValidInviteCode(parsed.data.code)) {
		return NextResponse.json({ ok: false }, { status: 403 });
	}

	return NextResponse.json({ ok: true });
}
