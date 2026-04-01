import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { getConnector, processEmail } from "@repo/email-processor";
import { protectedProcedure } from "../../../orpc/procedures";
import { triggerNotification } from "../../notifications/lib/trigger";
import { ensureFeishuOAuthAccessToken } from "../lib/feishu-oauth-token";
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

		const connectionWithToken =
			connection.provider === "feishu"
				? await ensureFeishuOAuthAccessToken(connection)
				: connection;

		const connector = getConnector(connectionWithToken.provider);

		console.log(
			`[Sync] Starting sync for ${connectionWithToken.provider}:${connectionWithToken.email}, cursor=${connectionWithToken.syncCursor}`,
		);

		const { emails, newCursor } = await connector.fetchNewEmails(
			{
				provider: connectionWithToken.provider,
				email: connectionWithToken.email,
				accessToken: connectionWithToken.accessToken,
				refreshToken: connectionWithToken.refreshToken,
				imapHost: connectionWithToken.imapHost,
				imapPort: connectionWithToken.imapPort,
				imapPassword: connectionWithToken.imapPassword,
				authType: connectionWithToken.authType,
				maxSyncCount: connectionWithToken.maxSyncCount,
			},
			connectionWithToken.syncCursor,
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
						connectionId: connectionWithToken.id,
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
				organizationId: connectionWithToken.organizationId,
				connectionId: connectionWithToken.id,
				externalThreadId: email.externalId,
				receivedAt: email.receivedAt,
				messageId: email.messageId,
			});

			if (result.success) {
				processed++;
				console.log(`[Sync] Processed: "${email.subject}" → ${result.categorySlug ?? result.classification}`);

				if (result.entityId) {
					triggerNotification({
						organizationId: connectionWithToken.organizationId,
						type: "NEW_ENTITY",
						entityId: result.entityId,
						title: `新事项：${email.subject}`,
						body: `来自 ${email.senderEmail} 的邮件已创建新事项（${result.classification ?? "未分类"}）`,
					}).catch((err) => {
						console.error("[Sync] Notification trigger failed:", err);
					});
				}
			} else {
				errors++;
				console.error(`[Sync] Failed: "${email.subject}" → ${result.error}`);
			}
		}

		console.log(`[Sync] Done: fetched=${emails.length}, processed=${processed}, errors=${errors}`);

		await db.emailConnection.update({
			where: { id: connectionWithToken.id },
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
