import { google } from "googleapis";
import type {
	ConnectionCredentials,
	EmailConnector,
	RawEmail,
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
	return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractEmailContent(payload: Record<string, unknown>): string {
	const parts = payload.parts as Array<Record<string, unknown>> | undefined;
	if (parts) {
		for (const part of parts) {
			if (part.mimeType === "text/plain" && part.body) {
				const body = part.body as { data?: string };
				if (body.data) return decodeBase64Url(body.data);
			}
		}
		for (const part of parts) {
			if (part.mimeType === "text/html" && part.body) {
				const body = part.body as { data?: string };
				if (body.data) return decodeBase64Url(body.data);
			}
		}
	}

	const body = payload.body as { data?: string } | undefined;
	if (body?.data) return decodeBase64Url(body.data);

	return "";
}

function getHeader(
	headers: Array<{ name: string; value: string }>,
	name: string,
): string {
	return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseSenderName(from: string): { name: string; email: string } {
	const match = from.match(/^"?(.+?)"?\s*<(.+?)>$/);
	if (match) return { name: match[1].trim(), email: match[2].trim() };
	return { name: from, email: from };
}

export const gmailConnector: EmailConnector = {
	async fetchNewEmails(
		credentials: ConnectionCredentials,
		cursor?: string | null,
	): Promise<SyncResult> {
		const auth = createOAuth2Client(credentials);
		const gmail = google.gmail({ version: "v1", auth });

		const query = cursor ? `after:${cursor}` : "newer_than:1d";

		const listRes = await gmail.users.messages.list({
			userId: "me",
			q: query,
			maxResults: 50,
		});

		const messageIds = listRes.data.messages ?? [];
		const emails: RawEmail[] = [];

		for (const msg of messageIds) {
			if (!msg.id) continue;

			const detail = await gmail.users.messages.get({
				userId: "me",
				id: msg.id,
				format: "full",
			});

			const payload = detail.data.payload;
			if (!payload) continue;

			const headers = (payload.headers ?? []) as Array<{
				name: string;
				value: string;
			}>;
			const from = getHeader(headers, "From");
			const subject = getHeader(headers, "Subject");
			const to = getHeader(headers, "To");
			const date = getHeader(headers, "Date");

			const { name, email } = parseSenderName(from);
			const content = extractEmailContent(payload as Record<string, unknown>);

			emails.push({
				externalId: msg.id,
				subject,
				sender: name,
				senderEmail: email,
				recipients: to.split(",").map((r) => r.trim()),
				content,
				snippet: detail.data.snippet ?? "",
				receivedAt: date ? new Date(date) : new Date(),
				threadId: detail.data.threadId ?? undefined,
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
