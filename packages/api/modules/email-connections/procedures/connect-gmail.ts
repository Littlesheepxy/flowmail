import { db } from "@repo/database";
import { google } from "googleapis";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { connectGmailSchema } from "../types";

export const connectGmail = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/gmail",
		tags: ["EmailConnections"],
		summary: "Connect a Gmail account via OAuth",
	})
	.input(connectGmailSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);
		const oauth2Client = new google.auth.OAuth2(
			process.env.GMAIL_CLIENT_ID,
			process.env.GMAIL_CLIENT_SECRET,
			input.redirectUri,
		);

		const { tokens } = await oauth2Client.getToken(input.authCode);
		oauth2Client.setCredentials(tokens);

		const gmail = google.gmail({ version: "v1", auth: oauth2Client });
		const profile = await gmail.users.getProfile({ userId: "me" });
		const email = profile.data.emailAddress;

		if (!email) throw new Error("Could not retrieve email address from Gmail");

		const connection = await db.emailConnection.upsert({
			where: {
				organizationId_email: {
					organizationId: input.organizationId,
					email,
				},
			},
			create: {
				organizationId: input.organizationId,
				provider: "gmail",
				authType: "oauth2",
				email,
				accessToken: tokens.access_token ?? "",
				refreshToken: tokens.refresh_token ?? "",
				tokenExpiresAt: tokens.expiry_date
					? new Date(tokens.expiry_date)
					: null,
				isActive: true,
			},
			update: {
				accessToken: tokens.access_token ?? "",
				refreshToken: tokens.refresh_token ?? undefined,
				tokenExpiresAt: tokens.expiry_date
					? new Date(tokens.expiry_date)
					: null,
				isActive: true,
			},
		});

		return {
			id: connection.id,
			email: connection.email,
			provider: connection.provider,
		};
	});
