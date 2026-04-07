import { google } from "googleapis";
import type {
	ConnectionCredentials,
	EmailConnector,
	EmailRecipient,
	RawEmail,
	RawEmailAttachment,
	SyncResult,
} from "./types";

function createOAuth2Client(credentials: ConnectionCredentials) {
	const oauth2Client = new google.auth.OAuth2(
		process.env.GMAIL_CLIENT_ID,
		process.env.GMAIL_CLIENT_SECRET,
	);
	oauth2Client.setCredentials({
		access_token: credentials.accessToken,
		refresh_token: credentials.refreshToken,
	});
	return oauth2Client;
}

function decodeBase64Url(data: string): string {
	return Buffer.from(
		data.replace(/-/g, "+").replace(/_/g, "/"),
		"base64",
	).toString("utf-8");
}

function extractEmailParts(payload: Record<string, unknown>): {
	text: string;
	html: string;
} {
	let text = "";
	let html = "";
	const parts = payload.parts as Array<Record<string, unknown>> | undefined;
	if (parts) {
		for (const part of parts) {
			if (part.mimeType === "text/plain" && part.body && !text) {
				const body = part.body as { data?: string };
				if (body.data) {
					text = decodeBase64Url(body.data);
				}
			}
			if (part.mimeType === "text/html" && part.body && !html) {
				const body = part.body as { data?: string };
				if (body.data) {
					html = decodeBase64Url(body.data);
				}
			}
		}
	}

	if (!text && !html) {
		const body = payload.body as { data?: string } | undefined;
		if (body?.data) {
			text = decodeBase64Url(body.data);
		}
	}

	return { text, html };
}

function getHeader(
	headers: Array<{ name: string; value: string }>,
	name: string,
): string {
	return (
		headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
			?.value ?? ""
	);
}

function parseSenderName(from: string): { name: string; email: string } {
	const match = from.match(/^"?(.+?)"?\s*<(.+?)>$/);
	if (match) {
		return { name: match[1].trim(), email: match[2].trim() };
	}
	return { name: from, email: from };
}

function parseRecipientList(raw: string): EmailRecipient[] {
	if (!raw) {
		return [];
	}
	return raw.split(",").map((entry) => {
		const parsed = parseSenderName(entry.trim());
		return {
			name: parsed.name !== parsed.email ? parsed.name : undefined,
			address: parsed.email,
		};
	});
}

function extractAttachments(
	payload: Record<string, unknown>,
	messageId: string,
): RawEmailAttachment[] {
	const results: RawEmailAttachment[] = [];
	const parts = payload.parts as Array<Record<string, unknown>> | undefined;
	if (!parts) {
		return results;
	}

	for (const part of parts) {
		const filename = part.filename as string | undefined;
		const body = part.body as
			| { attachmentId?: string; size?: number }
			| undefined;
		if (filename && body?.attachmentId) {
			results.push({
				filename,
				mimeType: part.mimeType as string | undefined,
				size: body.size,
				externalId: `${messageId}/${body.attachmentId}`,
				contentId: (
					part.headers as
						| Array<{ name: string; value: string }>
						| undefined
				)
					?.find((h) => h.name.toLowerCase() === "content-id")
					?.value?.replace(/[<>]/g, ""),
			});
		}
	}
	return results;
}

export const gmailConnector: EmailConnector = {
	async fetchNewEmails(
		credentials: ConnectionCredentials,
		cursor?: string | null,
	): Promise<SyncResult> {
		const auth = createOAuth2Client(credentials);
		const gmail = google.gmail({ version: "v1", auth });

		const isFirstSync = !cursor;
		const query = cursor ? `after:${cursor}` : "newer_than:30d";
		const maxTotal = credentials.maxSyncCount ?? (isFirstSync ? 200 : 50);
		const perPage = Math.min(maxTotal, 100);

		const allMessageIds: Array<{ id: string }> = [];
		let pageToken: string | undefined;

		do {
			const listRes = await gmail.users.messages.list({
				userId: "me",
				q: query,
				maxResults: perPage,
				pageToken,
			});

			const msgs = listRes.data.messages ?? [];
			for (const m of msgs) {
				if (m.id) {
					allMessageIds.push({ id: m.id });
				}
			}

			pageToken = listRes.data.nextPageToken ?? undefined;
		} while (pageToken && allMessageIds.length < maxTotal);

		const messageIds = allMessageIds.slice(0, maxTotal);
		const emails: RawEmail[] = [];

		for (const msg of messageIds) {
			const detail = await gmail.users.messages.get({
				userId: "me",
				id: msg.id,
				format: "full",
			});

			const payload = detail.data.payload;
			if (!payload) {
				continue;
			}

			const headers = (payload.headers ?? []) as Array<{
				name: string;
				value: string;
			}>;
			const from = getHeader(headers, "From");
			const subject = getHeader(headers, "Subject");
			const to = getHeader(headers, "To");
			const cc = getHeader(headers, "Cc");
			const date = getHeader(headers, "Date");
			const rfcMessageId =
				getHeader(headers, "Message-ID") ||
				getHeader(headers, "Message-Id");

			const { name, email } = parseSenderName(from);
			const { text: bodyText, html: bodyHtml } = extractEmailParts(
				payload as Record<string, unknown>,
			);
			const content = bodyText || bodyHtml;

			const toRecipients = parseRecipientList(to);
			const ccRecipients = parseRecipientList(cc);

			const attachments = extractAttachments(
				payload as Record<string, unknown>,
				msg.id,
			);

			emails.push({
				externalId: msg.id,
				subject,
				sender: name,
				senderEmail: email,
				recipients: to.split(",").map((r) => r.trim()),
				toRecipients,
				ccRecipients:
					ccRecipients.length > 0 ? ccRecipients : undefined,
				content,
				snippet: detail.data.snippet ?? "",
				bodyHtml: bodyHtml || undefined,
				bodyText: bodyText || undefined,
				attachments: attachments.length > 0 ? attachments : undefined,
				receivedAt: date ? new Date(date) : new Date(),
				threadId: detail.data.threadId ?? undefined,
				messageId: rfcMessageId || undefined,
			});
		}

		const newCursor = Math.floor(Date.now() / 1000).toString();

		return { emails, newCursor };
	},

	async testConnection(credentials: ConnectionCredentials): Promise<boolean> {
		try {
			const auth = createOAuth2Client(credentials);
			const gmail = google.gmail({ version: "v1", auth });
			const profile = await gmail.users.getProfile({ userId: "me" });
			return !!profile.data.emailAddress;
		} catch {
			return false;
		}
	},
};
