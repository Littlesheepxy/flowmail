import { db, encryptSensitiveFields } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { z } from "zod";

const connectOutlookSchema = z.object({
	organizationId: z.string(),
	authCode: z.string(),
	redirectUri: z.string().url(),
});

export const connectOutlook = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/outlook",
		tags: ["EmailConnections"],
		summary: "Connect an Outlook account via Microsoft OAuth",
	})
	.input(connectOutlookSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const clientId = process.env.MICROSOFT_CLIENT_ID;
		const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

		if (!clientId || !clientSecret) {
			throw new Error("Microsoft OAuth is not configured (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)");
		}

		const tokenBody = new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			code: input.authCode,
			redirect_uri: input.redirectUri,
			grant_type: "authorization_code",
		});

		const tokenRes = await fetch(
			"https://login.microsoftonline.com/common/oauth2/v2.0/token",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: tokenBody.toString(),
			},
		);

		if (!tokenRes.ok) {
			const errText = await tokenRes.text();
			throw new Error(`Microsoft token exchange failed: ${errText}`);
		}

		const tokens = (await tokenRes.json()) as {
			access_token: string;
			refresh_token?: string;
			expires_in: number;
		};

		const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
			headers: { Authorization: `Bearer ${tokens.access_token}` },
		});

		if (!profileRes.ok) {
			throw new Error("Failed to fetch Microsoft profile");
		}

		const profile = (await profileRes.json()) as {
			mail?: string;
			userPrincipalName?: string;
		};

		const email = profile.mail ?? profile.userPrincipalName;
		if (!email) {
			throw new Error("Could not retrieve email address from Microsoft");
		}

		const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

		const encryptedCreate = encryptSensitiveFields({
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token ?? "",
		});
		const encryptedUpdate = encryptSensitiveFields({
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token ?? undefined,
		});

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
				tokenExpiresAt: expiresAt,
				isActive: true,
			},
			update: {
				...encryptedUpdate,
				tokenExpiresAt: expiresAt,
				isActive: true,
			},
		});

		return {
			id: connection.id,
			email: connection.email,
			provider: connection.provider,
		};
	});
