import { isValidInviteCode } from "@repo/auth/server/invite-codes";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
	code: z.string().min(1),
});

export async function POST(request: Request) {
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
