import { ORPCError } from "@orpc/client";
import { db, decryptSensitiveFields } from "@repo/database";
import {
	getConnector,
	processEmail,
	storeEmailOnly,
} from "@repo/email-processor";
import { writeAuditLog } from "../../../lib/audit-log";
import { checkRateLimit, RATE_LIMITS } from "../../../lib/rate-limit";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
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
	.handler(async ({ input, context }) => {
		const rl = checkRateLimit(
			`email-sync:${input.connectionId}`,
			RATE_LIMITS.emailSync,
		);
		if (!rl.allowed) {
			throw new ORPCError("TOO_MANY_REQUESTS", {
				message: `Sync rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s`,
			});
		}

		const connection = await db.emailConnection.findUnique({
			where: { id: input.connectionId },
		});

		if (!connection) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(
			connection.organizationId,
			context.user.id,
		);

		if (!connection.isActive) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Connection is inactive",
			});
		}

		const decryptedConnection = decryptSensitiveFields(connection);
		const connectionWithToken =
			decryptedConnection.provider === "feishu"
				? await ensureFeishuOAuthAccessToken(decryptedConnection)
				: decryptedConnection;

		const connector = getConnector(connectionWithToken.provider);

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

		let processed = 0;
		let stored = 0;
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
				continue;
			}

			if (input.skipClassification) {
				const storeResult = await storeEmailOnly({
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
				if (storeResult.success) {
					stored++;
				} else {
					errors++;
				}
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

				if (result.entityId) {
					triggerNotification({
						organizationId: connectionWithToken.organizationId,
						type: "NEW_ENTITY",
						entityId: result.entityId,
						title: `新事项：${email.subject}`,
						body: `来自 ${email.senderEmail} 的邮件已创建新事项（${result.classification ?? "未分类"}）`,
					}).catch(() => {});
				}
			} else {
				errors++;
				console.error("[Sync] Processing failed", {
					connectionId: connectionWithToken.id,
					error: result.error,
				});
			}
		}

		await db.emailConnection.update({
			where: { id: connectionWithToken.id },
			data: {
				lastSyncAt: new Date(),
				...(newCursor ? { syncCursor: newCursor } : {}),
			},
		});

		writeAuditLog({
			organizationId: connectionWithToken.organizationId,
			userId: context.user.id,
			action: "EMAIL_SYNC",
			targetType: "EmailConnection",
			targetId: connectionWithToken.id,
			metadata: {
				fetched: emails.length,
				processed,
				stored,
				errors,
				skipClassification: !!input.skipClassification,
			},
		});

		return {
			fetched: emails.length,
			processed,
			stored,
			errors,
			skipClassification: !!input.skipClassification,
		};
	});
