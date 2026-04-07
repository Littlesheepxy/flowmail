import { db, encryptSensitiveFields } from "@repo/database";
import { writeAuditLog } from "../../../lib/audit-log";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { connectOutlookSchema } from "../types";

const MICROSOFT_TOKEN_URL =
	"https://login.microsoftonline.com/common/oauth2/v2.0/token";

export const connectOutlook = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/outlook",
		tags: ["EmailConnections"],
		summary: "Connect a Microsoft 365/Outlook account via OAuth",
	})
	.input(connectOutlookSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const clientId = process.env.MICROSOFT_CLIENT_ID;
		const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

		if (!clientId || !clientSecret) {
			throw new Error(
				"Microsoft OAuth is not configured (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)",
			);
		}

		const tokenRes = await fetch(MICROSOFT_TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				code: input.authCode,
				redirect_uri: input.redirectUri,
				grant_type: "authorization_code",
				scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
			}).toString(),
		});

		if (!tokenRes.ok) {
			const errBody = await tokenRes.text();
			throw new Error(
				`Microsoft token exchange failed (${tokenRes.status}): ${errBody}`,
			);
		}

		const tokens = (await tokenRes.json()) as {
			access_token: string;
			refresh_token?: string;
			expires_in?: number;
		};

		if (!tokens.access_token) {
			throw new Error("No access token returned from Microsoft");
		}

		const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
			headers: { Authorization: `Bearer ${tokens.access_token}` },
		});

		if (!profileRes.ok) {
			throw new Error("Failed to fetch Microsoft user profile");
		}

		const profile = (await profileRes.json()) as {
			mail?: string;
			userPrincipalName?: string;
		};

		const email = profile.mail ?? profile.userPrincipalName;
		if (!email) {
			throw new Error(
				"Could not retrieve email address from Microsoft account",
			);
		}

		const encryptedCreate = encryptSensitiveFields({
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token ?? "",
		});
		const encryptedUpdate = encryptSensitiveFields({
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token ?? undefined,
		});

		const now = new Date();
		const connection = await db.emailConnection.upsert({
			where: {
				organizationId_email: {
					organizationId: input.organizationId,
					email,
				},
			},
			create: {
				organizationId: input.organizationId,
				provider: "outlook",
				authType: "oauth2",
				email,
				...encryptedCreate,
				tokenExpiresAt: tokens.expires_in
					? new Date(Date.now() + tokens.expires_in * 1000)
					: null,
				isActive: true,
				consentedAt: now,
				consentScope: "sync,classify,extract",
				consentUserId: context.user.id,
			},
			update: {
				...encryptedUpdate,
				tokenExpiresAt: tokens.expires_in
					? new Date(Date.now() + tokens.expires_in * 1000)
					: null,
				isActive: true,
				consentedAt: now,
				consentScope: "sync,classify,extract",
				consentUserId: context.user.id,
			},
		});

		writeAuditLog({
			organizationId: input.organizationId,
			userId: context.user.id,
			action: "EMAIL_CONNECTION_CREATE",
			targetType: "EmailConnection",
			targetId: connection.id,
			metadata: { provider: "outlook", email },
		});

		return {
			id: connection.id,
			email: connection.email,
			provider: connection.provider,
		};
	});
