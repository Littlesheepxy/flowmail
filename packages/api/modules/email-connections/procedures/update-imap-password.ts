import { ORPCError } from "@orpc/client";
import { db, encryptSensitiveFields } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateImapPasswordSchema } from "../types";

export const updateImapPassword = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/{connectionId}/imap-password",
		tags: ["EmailConnections"],
		summary: "Set or update the IMAP password for an existing connection",
	})
	.input(updateImapPasswordSchema)
	.handler(async ({ input, context }) => {
		const connection = await db.emailConnection.findUnique({
			where: { id: input.connectionId },
		});

		if (!connection) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(connection.organizationId, context.user.id);

		const encrypted = encryptSensitiveFields({ imapPassword: input.imapPassword });
		const updated = await db.emailConnection.update({
			where: { id: input.connectionId },
			data: {
				imapPassword: encrypted.imapPassword,
				authType: "password",
			},
		});

		return {
			id: updated.id,
			email: updated.email,
		};
	});
