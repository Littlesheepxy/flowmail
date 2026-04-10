import {
	resolveOrganizationByInboundAddress,
	triggerNotification,
	writeAuditLog,
} from "@repo/api";
import { processInboundEmail } from "@repo/email-processor";
import { logger } from "@repo/logs";
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

		const result = await processInboundEmail({
			organizationId,
			fromEmail,
			subject: data.subject || "(No subject)",
			textBody,
			htmlBody,
			rawPayload: data,
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
