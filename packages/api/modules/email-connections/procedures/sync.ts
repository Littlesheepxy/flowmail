import { ORPCError } from "@orpc/client";
import { db, decryptSensitiveFields } from "@repo/database";
import { getConnector, processEmailRaw, enrichEntityById } from "@repo/email-processor";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { ensureFeishuOAuthAccessToken } from "../lib/feishu-oauth-token";
import { syncConnectionSchema } from "../types";

export const syncEmailConnection = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/{connectionId}/sync",
		tags: ["EmailConnections"],
		summary: "Sync new emails from a connection (raw import, no AI)",
	})
	.input(syncConnectionSchema)
	.handler(async ({ input, context }) => {
		const connection = await db.emailConnection.findUnique({
			where: { id: input.connectionId },
		});

		if (!connection) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(connection.organizationId, context.user.id);

		if (!connection.isActive) {
			throw new ORPCError("BAD_REQUEST", { message: "Connection is inactive" });
		}

		const decryptedConnection = decryptSensitiveFields(connection);
		const connectionWithToken =
			decryptedConnection.provider === "feishu"
				? await ensureFeishuOAuthAccessToken(decryptedConnection)
				: decryptedConnection;

		const connector = getConnector(connectionWithToken.provider);

		const syncCursor = input.force ? undefined : connectionWithToken.syncCursor;

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
			syncCursor ?? null,
		);

		let processed = 0;
		let skipped = 0;
		let updated = 0;
		let errors = 0;
		const newEntityIds: string[] = [];
		const forceRefresh = input.force === true;

		for (const email of emails) {
			const existing = await db.emailThread.findUnique({
				where: {
					connectionId_externalThreadId: {
						connectionId: connectionWithToken.id,
						externalThreadId: email.externalId,
					},
				},
			});

			if (existing && forceRefresh) {
				try {
					await db.emailThread.update({
						where: { id: existing.id },
						data: {
							bodyHtml: email.bodyHtml ?? existing.bodyHtml,
							bodyText: email.bodyText ?? existing.bodyText,
							snippet: (email.bodyText || email.content || "").slice(0, 200) || existing.snippet,
							subject: email.subject || existing.subject,
						},
					});

					if (email.attachments && email.attachments.length > 0) {
						const existingAtts = await db.emailAttachment.count({ where: { threadId: existing.id } });
						if (existingAtts === 0) {
							await db.emailAttachment.createMany({
								data: email.attachments.map((att) => ({
									threadId: existing.id,
									filename: att.filename,
									mimeType: att.mimeType ?? null,
									size: att.size ?? null,
									externalId: att.externalId,
									contentId: att.contentId ?? null,
								})),
							});
						}
					}

					updated++;
				} catch {
					errors++;
				}
				continue;
			}

			if (existing) {
				skipped++;
				continue;
			}

			const result = await processEmailRaw({
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
					newEntityIds.push(result.entityId);
				}
			} else {
				errors++;
				console.error("[Sync] Raw import failed", { connectionId: connectionWithToken.id, error: result.error });
			}
		}

		await db.emailConnection.update({
			where: { id: connectionWithToken.id },
			data: {
				lastSyncAt: new Date(),
				...(newCursor ? { syncCursor: newCursor } : {}),
			},
		});

		if (newEntityIds.length > 0) {
			try {
				const org = await db.organization.findUnique({
					where: { id: connectionWithToken.organizationId },
					select: { metadata: true },
				});
				const meta = org?.metadata ? JSON.parse(org.metadata) : {};
				if (meta.autoAiAnalysis) {
					for (const eid of newEntityIds) {
						enrichEntityById(eid).catch((err) => {
							console.error("[Sync] Auto AI enrich failed", {
								entityId: eid,
								error: err instanceof Error ? err.message : String(err),
							});
						});
					}
				}
			} catch {
				// non-critical
			}
		}

		return {
			fetched: emails.length,
			processed,
			skipped,
			updated,
			errors,
		};
	});
