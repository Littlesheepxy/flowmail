import { getPendingInvitationByEmail } from "@repo/database";
import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/plugins";
import { config } from "../../config";
import { isInviteGateEnabled, isValidInviteCode } from "../../lib/invite-codes";

export const inviteCodePlugin = () =>
	({
		id: "inviteCodePlugin",
		hooks: {
			before: [
				{
					matcher: (context) =>
						context.path.startsWith("/sign-up/email"),
					handler: createAuthMiddleware(async (ctx) => {
						if (!config.enableSignup || !isInviteGateEnabled()) {
							return;
						}

						const body = ctx.body as {
							email?: string;
							inviteCode?: string;
						};

						const email = body.email;
						if (email) {
							const hasInvitation =
								await getPendingInvitationByEmail(email);
							if (hasInvitation) {
								return;
							}
						}

						if (!isValidInviteCode(body.inviteCode)) {
							throw new APIError("FORBIDDEN", {
								code: "INVALID_INVITE_CODE",
								message: "Invalid or missing invite code",
							});
						}
					}),
				},
			],
		},
		$ERROR_CODES: {
			INVALID_INVITE_CODE: "Invalid or missing invite code",
		},
	}) satisfies BetterAuthPlugin;
