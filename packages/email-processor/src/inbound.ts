import { db } from "@repo/database";
import { createHash } from "node:crypto";
import { triggerEmailAiNoteIfNeeded } from "./email-ai-note";
import { unwrapForwardedEmail } from "./unwrap-forward";

export interface InboundAttachment {
	filename: string;
	mimeType?: string;
	size?: number;
	externalId: string;
	contentId?: string;
	storageKey?: string; // S3 key if already uploaded by caller
}

interface InboundEmailInput {
	organizationId: string;
	fromEmail: string;
	subject: string;
	textBody?: string;
	htmlBody?: string;
	rawHeaders?: string;
	rawPayload?: unknown;
	attachments?: InboundAttachment[];
}

interface InboundProcessResult {
	success: boolean;
	inboundEmailId?: string;
	entityId?: string;
	entityTitle?: string;
	categorySlug?: string;
	aiSummary?: string;
	duplicate: boolean;
	error?: string;
}

export function computeContentHash(
	subject: string,
	sender: string,
	receivedAt: Date,
): string {
	const minuteKey = `${receivedAt.getFullYear()}-${receivedAt.getMonth()}-${receivedAt.getDate()}-${receivedAt.getHours()}-${receivedAt.getMinutes()}`;
	const raw = `${subject.trim().toLowerCase()}|${sender.trim().toLowerCase()}|${minuteKey}`;
	return createHash("sha256").update(raw).digest("hex");
}

export async function processInboundEmail(
	input: InboundEmailInput,
): Promise<InboundProcessResult> {
	try {
		const rawContent = input.textBody || stripHtml(input.htmlBody || "") || "";

		const unwrapped = unwrapForwardedEmail({
			subject: input.subject,
			sender: input.fromEmail,
			senderEmail: input.fromEmail,
			content: rawContent,
			bodyText: input.textBody,
		});

		const effectiveFrom = unwrapped.originalSender ?? input.fromEmail;
		const effectiveSubject = unwrapped.originalSubject ?? input.subject;
		const content = unwrapped.cleanBody ?? rawContent;

		const contentHash = computeContentHash(
			effectiveSubject,
			effectiveFrom,
			new Date(),
		);

		// ── Dedup check ──────────────────────────────────────────────────────────
		const existingByHash = await db.inboundEmail.findUnique({
			where: { contentHash },
		});
		if (existingByHash) {
			return {
				success: true,
				duplicate: true,
				inboundEmailId: existingByHash.id,
				entityId: existingByHash.entityId ?? undefined,
			};
		}

		// ── Thread 匹配：同主题同发件人 → 归并到已有事项，而不是丢弃 ────────────────
		const existingByThread = await db.emailThread.findFirst({
			where: {
				organizationId: input.organizationId,
				OR: [
					{
						subject: { contains: normalizeSubject(effectiveSubject) },
						sender: effectiveFrom,
					},
				],
				entityId: { not: null },
			},
			orderBy: { receivedAt: "desc" },
			select: { entityId: true, id: true },
		});

		const entityTitle =
			effectiveSubject.replace(/^(Fwd?:|Fw:|转发：)\s*/gi, "").trim() ||
			"Untitled";

		// 归并模式：追加新邮件到已有事项
		if (existingByThread?.entityId) {
			const inboundEmail = await db.inboundEmail.create({
				data: {
					organizationId: input.organizationId,
					fromEmail: input.fromEmail,
					subject: input.subject,
					textBody: input.textBody,
					htmlBody: input.htmlBody,
					rawHeaders: input.rawHeaders,
					rawPayload: input.rawPayload as never,
					contentHash,
					entityId: existingByThread.entityId,
					processedAt: new Date(),
				},
			});

			const thread = await db.emailThread.create({
				data: {
					organizationId: input.organizationId,
					entityId: existingByThread.entityId,
					externalThreadId: inboundEmail.id,
					subject: effectiveSubject,
					sender: effectiveFrom,
					senderName: unwrapped.originalSenderName ?? effectiveFrom.split("@")[0],
					snippet: content.slice(0, 200),
					bodyHtml: input.htmlBody,
					bodyText: content,
					messageId: (input.rawPayload as Record<string, unknown>)?.message_id as string | undefined,
					participants: JSON.stringify([effectiveFrom, ...(unwrapped.forwarderEmail ? [unwrapped.forwarderEmail] : [])]),
					receivedAt: new Date(),
				},
			});

			if (input.attachments && input.attachments.length > 0) {
				await db.emailAttachment.createMany({
					data: input.attachments.map((att) => ({
						threadId: thread.id,
						filename: att.filename,
						mimeType: att.mimeType,
						size: att.size,
						externalId: att.externalId,
						contentId: att.contentId,
						storageKey: att.storageKey,
					})),
				});
			}

			await db.timelineEvent.create({
				data: {
					entityId: existingByThread.entityId,
					type: "email_received",
					content: `追加邮件 from ${effectiveFrom}: ${effectiveSubject}`,
					metadata: JSON.stringify({
						source: "inbound_merged",
						threadId: thread.id,
						inboundEmailId: inboundEmail.id,
						fromEmail: effectiveFrom,
						subject: effectiveSubject,
						isForwarded: unwrapped.isForwarded || undefined,
						forwarder: unwrapped.forwarderEmail || undefined,
					}),
				},
			});

			// 异步触发 per-email AI 提炼（fire-and-forget，不阻塞响应）
			void triggerEmailAiNoteIfNeeded({
				entityId: existingByThread.entityId,
				threadId: thread.id,
				reason: "inbound_merged",
			}).catch((err) =>
				console.warn(
					"[inbound] auto email-ai-note failed (non-critical):",
					err instanceof Error ? err.message : String(err),
				),
			);

			await db.flowEntity.update({
				where: { id: existingByThread.entityId },
				data: { updatedAt: new Date() },
			});

			return {
				success: true,
				duplicate: false,
				inboundEmailId: inboundEmail.id,
				entityId: existingByThread.entityId,
				entityTitle,
				categorySlug: "merged",
			};
		}

		// ── Step 1: 全新事项 — 立即写库，前台秒显示 ──────────────────────────────────

		const inboundEmail = await db.inboundEmail.create({
			data: {
				organizationId: input.organizationId,
				fromEmail: input.fromEmail,
				subject: input.subject,
				textBody: input.textBody,
				htmlBody: input.htmlBody,
				rawHeaders: input.rawHeaders,
				rawPayload: input.rawPayload as never,
				contentHash,
			},
		});

		const entity = await db.flowEntity.create({
			data: {
				organizationId: input.organizationId,
				type: "FEEDBACK" as never,
				title: entityTitle,
				status: "pending",
				extractedFields: JSON.stringify({}),
				aiSummary: null,
				aiConfidence: null,
				requiresReview: true,
			},
		});

		await db.inboundEmail.update({
			where: { id: inboundEmail.id },
			data: { entityId: entity.id, processedAt: new Date() },
		});

		let thread: { id: string };
		try {
			thread = await db.emailThread.create({
				data: {
					organizationId: input.organizationId,
					entityId: entity.id,
					externalThreadId: inboundEmail.id,
					subject: effectiveSubject,
					sender: effectiveFrom,
					senderName: unwrapped.originalSenderName ?? effectiveFrom.split("@")[0],
					snippet: content.slice(0, 200),
					bodyHtml: input.htmlBody,
					bodyText: content,
					messageId: (input.rawPayload as Record<string, unknown>)?.message_id as string | undefined,
					participants: JSON.stringify([effectiveFrom, ...(unwrapped.forwarderEmail ? [unwrapped.forwarderEmail] : [])]),
					receivedAt: new Date(),
				},
			});
		} catch (threadError) {
			console.error("[inbound] Failed to create email_thread:", {
				entityId: entity.id,
				inboundEmailId: inboundEmail.id,
				error: threadError instanceof Error ? threadError.message : String(threadError),
			});
			thread = await db.emailThread.create({
				data: {
					organizationId: input.organizationId,
					entityId: entity.id,
					externalThreadId: `${inboundEmail.id}-fallback`,
					subject: effectiveSubject,
					sender: effectiveFrom,
					senderName: unwrapped.originalSenderName ?? effectiveFrom.split("@")[0],
					snippet: content.slice(0, 200),
					bodyText: content || "[邮件内容请查看附件]",
					participants: JSON.stringify([effectiveFrom]),
					receivedAt: new Date(),
				},
			});
		}

		// Create attachment records
		if (input.attachments && input.attachments.length > 0) {
			await db.emailAttachment.createMany({
				data: input.attachments.map((att) => ({
					threadId: thread.id,
					filename: att.filename,
					mimeType: att.mimeType,
					size: att.size,
					externalId: att.externalId,
					contentId: att.contentId,
					storageKey: att.storageKey,
				})),
			});
		}

		await db.timelineEvent.create({
			data: {
				entityId: entity.id,
				type: "email_received",
				content: `Inbound email from ${effectiveFrom}: ${effectiveSubject}`,
				metadata: JSON.stringify({
					source: "inbound",
					threadId: thread.id,
					inboundEmailId: inboundEmail.id,
					fromEmail: effectiveFrom,
					subject: effectiveSubject,
					isForwarded: unwrapped.isForwarded || undefined,
					forwarder: unwrapped.forwarderEmail || undefined,
				}),
			},
		});

		// 异步触发 per-email AI 提炼（fire-and-forget，不阻塞响应）
		void triggerEmailAiNoteIfNeeded({
			entityId: entity.id,
			threadId: thread.id,
			reason: "inbound_first",
		}).catch((err) =>
			console.warn(
				"[inbound] auto email-ai-note failed (non-critical):",
				err instanceof Error ? err.message : String(err),
			),
		);

		return {
			success: true,
			duplicate: false,
			inboundEmailId: inboundEmail.id,
			entityId: entity.id,
			entityTitle,
			categorySlug: "feedback",
		};
	} catch (error) {
		return {
			success: false,
			duplicate: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

function normalizeSubject(subject: string): string {
	return subject
		.replace(/^(Re:|Fwd?:|Fw:|回复：|转发：)\s*/gi, "")
		.trim();
}

function stripHtml(html: string): string {
	return html
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
