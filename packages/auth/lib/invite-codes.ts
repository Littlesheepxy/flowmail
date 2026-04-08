/**
 * Comma-separated invite codes in FLOWMAIL_INVITE_CODES (e.g. ALPHA2026,BETA-FRIEND).
 * When non-empty, email sign-up must include a matching inviteCode (see invite-code plugin).
 */
export function getInviteCodes(): string[] {
	const raw = process.env.FLOWMAIL_INVITE_CODES ?? "";
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

export function isInviteGateEnabled(): boolean {
	return getInviteCodes().length > 0;
}

export function isValidInviteCode(code: string | undefined): boolean {
	if (!isInviteGateEnabled()) {
		return true;
	}
	const normalized = code?.trim();
	if (!normalized) {
		return false;
	}
	return getInviteCodes().includes(normalized);
}
