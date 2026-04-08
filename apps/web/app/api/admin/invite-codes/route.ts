import { auth } from "@repo/auth";
import {
	getInviteCodes,
	isInviteGateEnabled,
} from "@repo/auth/server/invite-codes";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (session.user.role !== "admin") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	return NextResponse.json({
		enabled: isInviteGateEnabled(),
		codes: getInviteCodes(),
		envVar: "FLOWMAIL_INVITE_CODES",
	});
}
