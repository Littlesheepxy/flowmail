import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { getConnector } from "@repo/email-processor";
import { protectedProcedure } from "../../../orpc/procedures";
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

		if (!connection) throw new ORPCError("NOT_FOUND");

		const connector = getConnector(connection.provider);
		const ok = await connector.testConnection({
			provider: connection.provider,
			email: connection.email,
			accessToken: connection.accessToken,
			refreshToken: connection.refreshToken,
			imapHost: connection.imapHost,
			imapPort: connection.imapPort,
			imapPassword: connection.imapPassword,
			authType: connection.authType,
		});

		return { connectionId: connection.id, working: ok };
	});
