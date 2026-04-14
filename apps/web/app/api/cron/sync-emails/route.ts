import { db, decryptSensitiveFields } from "@repo/database";
import { getConnector, processEmailRaw, enrichEntityById } from "@repo/email-processor";
import { logger } from "@repo/logs";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
	const secret = request.headers.get("authorization")?.replace("Bearer ", "");
	if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const connections = await db.emailConnection.findMany({
		where: { isActive: true },
	});

	if (connections.length === 0) {
		return NextResponse.json({ status: "no_connections" });
	}

	const results: { connectionId: string; email: string; fetched: number; processed: number; errors: number; autoEnriched: number }[] = [];

	for (const rawConn of connections) {
		const conn = decryptSensitiveFields(rawConn);
		try {
			const connector = getConnector(conn.provider);
			const { emails, newCursor } = await connector.fetchNewEmails(
				{
					provider: conn.provider,
					email: conn.email,
					accessToken: conn.accessToken,
					refreshToken: conn.refreshToken,
					imapHost: conn.imapHost,
					imapPort: conn.imapPort,
					imapPassword: conn.imapPassword,
					authType: conn.authType,
					maxSyncCount: conn.maxSyncCount,
				},
				conn.syncCursor,
			);

			let processed = 0;
			let errors = 0;
			let autoEnriched = 0;
			const newEntityIds: string[] = [];

			for (const email of emails) {
				const existing = await db.emailThread.findUnique({
					where: {
						connectionId_externalThreadId: {
							connectionId: conn.id,
							externalThreadId: email.externalId,
						},
					},
				});

				if (existing) {
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
					organizationId: conn.organizationId,
					connectionId: conn.id,
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
				}
			}

			await db.emailConnection.update({
				where: { id: conn.id },
				data: {
					lastSyncAt: new Date(),
					...(newCursor ? { syncCursor: newCursor } : {}),
				},
			});

			if (newEntityIds.length > 0) {
				try {
					const org = await db.organization.findUnique({
						where: { id: conn.organizationId },
						select: { metadata: true },
					});
					const meta = org?.metadata ? JSON.parse(org.metadata) : {};
					if (meta.autoAiAnalysis) {
						for (const eid of newEntityIds) {
							try {
								await enrichEntityById(eid);
								autoEnriched++;
							} catch {
								// non-critical
							}
						}
					}
				} catch {
					// non-critical
				}
			}

			results.push({
				connectionId: conn.id,
				email: conn.email,
				fetched: emails.length,
				processed,
				errors,
				autoEnriched,
			});
		} catch (err) {
			logger.error("Cron sync failed for connection", {
				connectionId: conn.id,
				email: conn.email,
				error: err instanceof Error ? err.message : String(err),
			});
			results.push({
				connectionId: conn.id,
				email: conn.email,
				fetched: 0,
				processed: 0,
				errors: 1,
				autoEnriched: 0,
			});
		}
	}

	const totalNew = results.reduce((s, r) => s + r.processed, 0);

	logger.info("Cron email sync completed", {
		connections: results.length,
		totalNew,
	});

	return NextResponse.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		connections: results.length,
		totalNew,
		results,
	});
}
