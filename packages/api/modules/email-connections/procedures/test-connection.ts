import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { getConnector } from "@repo/email-processor";
import { protectedProcedure } from "../../../orpc/procedures";
import { ensureFeishuOAuthAccessToken } from "../lib/feishu-oauth-token";
import { testConnectionSchema } from "../types";

export const testEmailConnection = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/{connectionId}/test",
		tags: ["EmailConnections"],
		summary: "Test if an email connection is working",
	})
	.input(testConnectionSchema)
	.handler(async ({ input }) => {
		const connection = await db.emailConnection.findUnique({
			where: { id: input.connectionId },
		});

		if (!connection) {
			throw new ORPCError("NOT_FOUND");
		}

		const connectionWithToken =
			connection.provider === "feishu"
				? await ensureFeishuOAuthAccessToken(connection)
				: connection;

		const connector = getConnector(connectionWithToken.provider);
		const ok = await connector.testConnection({
			provider: connectionWithToken.provider,
			email: connectionWithToken.email,
			accessToken: connectionWithToken.accessToken,
			refreshToken: connectionWithToken.refreshToken,
			imapHost: connectionWithToken.imapHost,
			imapPort: connectionWithToken.imapPort,
			imapPassword: connectionWithToken.imapPassword,
			authType: connectionWithToken.authType,
		});

		return { connectionId: connectionWithToken.id, working: ok };
	});
