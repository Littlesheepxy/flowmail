import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { getConnector, processEmail } from "@repo/email-processor";
import { protectedProcedure } from "../../../orpc/procedures";
import { syncConnectionSchema } from "../types";

export const syncEmailConnection = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/{connectionId}/sync",
		tags: ["EmailConnections"],
		summary: "Sync new emails from a connection and process them",
	})
	.input(syncConnectionSchema)
	.handler(async ({ input }) => {
		const connection = await db.emailConnection.findUnique({
			where: { id: input.connectionId },
		});

		if (!connection) {
			throw new ORPCError("NOT_FOUND");
		}
		if (!connection.isActive) {
			throw new ORPCError("BAD_REQUEST", { message: "Connection is inactive" });
		}

		const connector = getConnector(connection.provider);

		console.log(`[Sync] Starting sync for ${connection.provider}:${connection.email}, cursor=${connection.syncCursor}`);

		const { emails, newCursor } = await connector.fetchNewEmails(
			{
				provider: connection.provider,
				email: connection.email,
				accessToken: connection.accessToken,
				refreshToken: connection.refreshToken,
				imapHost: connection.imapHost,
				imapPort: connection.imapPort,
				imapPassword: connection.imapPassword,
				authType: connection.authType,
			},
			connection.syncCursor,
		);

		console.log(`[Sync] Fetched ${emails.length} emails, newCursor=${newCursor}`);
		if (emails.length > 0) {
			console.log(`[Sync] First email: "${emails[0].subject}" from ${emails[0].senderEmail}`);
		}

		let processed = 0;
		let errors = 0;

		for (const email of emails) {
			const existing = await db.emailThread.findUnique({
				where: {
					connectionId_externalThreadId: {
						connectionId: connection.id,
						externalThreadId: email.externalId,
					},
				},
			});

			if (existing) {
				console.log(`[Sync] Skip existing: "${email.subject}"`);
				continue;
			}

			const result = await processEmail({
				threadId: email.threadId ?? email.externalId,
				subject: email.subject,
				sender: email.sender,
				senderEmail: email.senderEmail,
				content: email.content,
				bodyHtml: email.bodyHtml,
				bodyText: email.bodyText,
				toRecipients: email.toRecipients,
				ccRecipients: email.ccRecipients,
				attachments: email.attachments,
				organizationId: connection.organizationId,
				connectionId: connection.id,
				externalThreadId: email.externalId,
				receivedAt: email.receivedAt,
			});

			if (result.success) {
				processed++;
				console.log(`[Sync] Processed: "${email.subject}" → ${result.categorySlug ?? result.classification}`);
			} else {
				errors++;
				console.error(`[Sync] Failed: "${email.subject}" → ${result.error}`);
			}
		}

		console.log(`[Sync] Done: fetched=${emails.length}, processed=${processed}, errors=${errors}`);

		await db.emailConnection.update({
			where: { id: connection.id },
			data: {
				lastSyncAt: new Date(),
				...(newCursor ? { syncCursor: newCursor } : {}),
			},
		});

		return {
			fetched: emails.length,
			processed,
			errors,
		};
	});
