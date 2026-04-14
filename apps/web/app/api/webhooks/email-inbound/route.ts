import {
	resolveOrganizationByInboundAddress,
	triggerNotification,
	writeAuditLog,
} from "@repo/api";
import { db } from "@repo/database";
import { processInboundEmail, enrichEntityById, type InboundAttachment } from "@repo/email-processor";
import { logger } from "@repo/logs";
import { uploadObject } from "@repo/storage";
import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
	if (!_resend) {
		_resend = new Resend(process.env.RESEND_API_KEY);
	}
	return _resend;
}

export const POST = async (request: NextRequest) => {
	try {
		const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

		if (webhookSecret) {
			const svixId = request.headers.get("svix-id");
			const svixTimestamp = request.headers.get("svix-timestamp");
			const svixSignature = request.headers.get("svix-signature");

			if (!svixId || !svixTimestamp || !svixSignature) {
				return NextResponse.json(
					{ error: "Missing webhook signature headers" },
					{ status: 401 },
				);
			}
		}

		const event = await request.json();

		if (event.type !== "email.received") {
			return NextResponse.json({ status: "ignored" });
		}

		const { data } = event;
		const toAddresses: string[] = data.to ?? [];

		let organizationId: string | null = null;
		for (const addr of toAddresses) {
			organizationId = await resolveOrganizationByInboundAddress(addr);
			if (organizationId) {
				break;
			}
		}

		if (!organizationId) {
			logger.warn("Inbound email to unknown address", {
				to: toAddresses,
				from: data.from,
				subject: data.subject,
			});
			return NextResponse.json({ status: "unknown_address" });
		}

		let textBody: string | undefined;
		let htmlBody: string | undefined;

		try {
			// Inbound emails use a different API endpoint: /emails/receiving/{id}
			// The regular /emails/{id} endpoint only works for outbound emails
			const res = await fetch(
				`https://api.resend.com/emails/receiving/${data.email_id}`,
				{
					headers: {
						Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
					},
				},
			);
			if (res.ok) {
				const detail = (await res.json()) as Record<string, unknown>;
				textBody = detail.text as string | undefined;
				htmlBody = detail.html as string | undefined;
			} else {
				logger.warn("Resend inbound email API non-200", {
					emailId: data.email_id,
					status: res.status,
				});
				textBody = `Subject: ${data.subject}\nFrom: ${data.from}`;
			}
		} catch (fetchError) {
			logger.warn("Failed to fetch inbound email content from Resend", {
				emailId: data.email_id,
				error:
					fetchError instanceof Error
						? fetchError.message
						: String(fetchError),
			});
			textBody = `Subject: ${data.subject}\nFrom: ${data.from}`;
		}

		const fromEmail = extractEmailAddress(data.from);

		// Parse and upload attachments from the Resend inbound payload
		const attachments: InboundAttachment[] = [];
		const rawAttachments = (data.attachments as ResendAttachment[] | undefined) ?? [];

		const storageEnabled = !!(
			process.env.S3_ENDPOINT &&
			process.env.S3_ACCESS_KEY_ID &&
			process.env.S3_SECRET_ACCESS_KEY
		);

		for (const att of rawAttachments) {
			if (!att.filename) { continue; }

			const attachment: InboundAttachment = {
				filename: att.filename,
				mimeType: att.content_type ?? att.mimeType,
				size: att.size,
				externalId: att.id ?? `${data.email_id}-${att.filename}`,
				contentId: att.content_id,
			};

			if (storageEnabled && att.content) {
				try {
					const buf = Buffer.from(att.content, "base64");
					const storageKey = `attachments/${organizationId}/${data.email_id}/${att.filename}`;
					await uploadObject(storageKey, buf, {
						bucket: "attachments",
						contentType: att.content_type ?? "application/octet-stream",
					});
					attachment.storageKey = storageKey;
					attachment.size = buf.length;
				} catch (uploadErr) {
					logger.warn("Failed to upload attachment to storage", {
						filename: att.filename,
						error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
					});
				}
			}

			attachments.push(attachment);
		}

		const result = await processInboundEmail({
			organizationId,
			fromEmail,
			subject: data.subject || "(No subject)",
			textBody,
			htmlBody,
			rawPayload: data,
			attachments,
		});

		if (result.duplicate) {
			return NextResponse.json({ status: "duplicate", ...result });
		}

		await writeAuditLog({
			organizationId,
			action: "INBOUND_EMAIL_RECEIVED",
			targetType: "InboundEmail",
			targetId: result.inboundEmailId,
			metadata: {
				from: fromEmail,
				subject: data.subject,
				entityId: result.entityId,
			},
		});

		if (result.success && result.entityId) {
			await triggerNotification({
				organizationId,
				type: "NEW_ENTITY",
				entityId: result.entityId,
				title: "收到新邮件",
				body: `${fromEmail} 转发了一封邮件: ${data.subject || "(无主题)"}`,
			});
		}

		if (result.success && result.entityId && !result.duplicate) {
			try {
				const org = await db.organization.findUnique({
					where: { id: organizationId },
					select: { metadata: true },
				});
				const meta = org?.metadata ? JSON.parse(org.metadata) : {};
				if (meta.autoAiAnalysis) {
					const eid = result.entityId;
					enrichEntityById(eid).catch((err) => {
						logger.warn("Auto AI enrich failed", {
							entityId: eid,
							error: err instanceof Error ? err.message : String(err),
						});
					});
				}
			} catch (autoAiErr) {
				logger.warn("Auto AI settings check failed", {
					error: autoAiErr instanceof Error ? autoAiErr.message : String(autoAiErr),
				});
			}
		}

		if (result.success && result.entityId && fromEmail) {
			try {
				await sendInboundProcessedReply({
					toEmail: fromEmail,
					originalSubject: data.subject || "(No subject)",
					entityTitle: result.entityTitle || data.subject,
					categorySlug: result.categorySlug,
					aiSummary: result.aiSummary,
					entityUrl:
						(process.env.NEXT_PUBLIC_APP_URL ||
							"https://app.flowmail.work") + "/app/inbox",
				});
			} catch (replyError) {
				logger.warn("Failed to send inbound processed reply", {
					error:
						replyError instanceof Error
							? replyError.message
							: String(replyError),
				});
			}
		}

		return NextResponse.json({ status: "processed", ...result });
	} catch (error) {
		logger.error("Inbound webhook error", {
			error: error instanceof Error ? error.message : String(error),
		});
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
};

interface ResendAttachment {
	id?: string;
	filename?: string;
	content?: string; // base64-encoded file content
	content_type?: string;
	mimeType?: string;
	content_id?: string;
	size?: number;
}

function extractEmailAddress(from: string): string {
	const match = from.match(/<([^>]+)>/);
	if (match) {
		return match[1];
	}
	if (from.includes("@")) {
		return from.trim();
	}
	return from;
}

async function sendInboundProcessedReply(params: {
	toEmail: string;
	originalSubject: string;
	entityTitle: string;
	categorySlug?: string;
	aiSummary?: string;
	entityUrl: string;
}) {
	const categoryLabel = params.categorySlug
		? params.categorySlug.charAt(0).toUpperCase() +
			params.categorySlug.slice(1)
		: "General";

	const textContent = [
		"Flowmail 已解析你的邮件",
		"",
		`类型: ${categoryLabel}`,
		params.aiSummary ? `摘要: ${params.aiSummary.slice(0, 200)}` : null,
		"",
		`查看详情: ${params.entityUrl}`,
		"",
		"---",
		"Flowmail 仅解析邮件内容用于生成待办和提醒，不会代你发送任何邮件。",
	]
		.filter(Boolean)
		.join("\n");

	await getResend().emails.send({
		from: process.env.MAIL_FROM || "Flowmail <noreply@flowmail.work>",
		to: [params.toEmail],
		subject: `Re: ${params.originalSubject}`,
		text: textContent,
	});
}
