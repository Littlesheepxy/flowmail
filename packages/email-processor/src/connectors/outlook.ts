import type {
	ConnectionCredentials,
	EmailConnector,
	EmailRecipient,
	RawEmail,
	RawEmailAttachment,
	SyncResult,
} from "./types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

interface GraphTokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
}

async function refreshAccessToken(refreshToken: string): Promise<GraphTokenResponse> {
	const body = new URLSearchParams({
		client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
		client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	});

	const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Microsoft token refresh failed: ${err}`);
	}

	return res.json() as Promise<GraphTokenResponse>;
}

async function graphFetch(accessToken: string, url: string): Promise<Response> {
	return fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
}

interface GraphMessage {
	id: string;
	subject: string;
	from?: { emailAddress: { name?: string; address: string } };
	toRecipients?: Array<{ emailAddress: { name?: string; address: string } }>;
	ccRecipients?: Array<{ emailAddress: { name?: string; address: string } }>;
	body?: { contentType: string; content: string };
	bodyPreview?: string;
	receivedDateTime: string;
	conversationId?: string;
	internetMessageId?: string;
	hasAttachments?: boolean;
}

interface GraphAttachment {
	id: string;
	name: string;
	contentType: string;
	size: number;
	contentId?: string;
	isInline?: boolean;
}

function mapRecipients(
	arr?: Array<{ emailAddress: { name?: string; address: string } }>,
): EmailRecipient[] {
	if (!arr) {
		return [];
	}
	return arr.map((r) => ({
		name: r.emailAddress.name || undefined,
		address: r.emailAddress.address,
	}));
}

export const outlookConnector: EmailConnector = {
	async fetchNewEmails(
		credentials: ConnectionCredentials,
		cursor?: string | null,
	): Promise<SyncResult> {
		let accessToken = credentials.accessToken ?? "";

		if (credentials.refreshToken) {
			try {
				const refreshed = await refreshAccessToken(credentials.refreshToken);
				accessToken = refreshed.access_token;
			} catch {
				// fall back to existing token
			}
		}

		const filter = cursor
			? `receivedDateTime gt ${cursor}`
			: `receivedDateTime gt ${new Date(Date.now() - 86400000).toISOString()}`;

		const url = `${GRAPH_BASE}/me/messages?$filter=${encodeURIComponent(filter)}&$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,ccRecipients,body,bodyPreview,receivedDateTime,conversationId,internetMessageId,hasAttachments`;

		const res = await graphFetch(accessToken, url);
		if (!res.ok) {
			throw new Error(`Graph API error: ${res.status} ${await res.text()}`);
		}

		const data = (await res.json()) as { value: GraphMessage[] };
		const emails: RawEmail[] = [];

		for (const msg of data.value) {
			const sender = msg.from?.emailAddress;
			const senderName = sender?.name ?? sender?.address ?? "Unknown";
			const senderEmail = sender?.address ?? "";

			const isHtml = msg.body?.contentType === "html";
			const bodyHtml = isHtml ? msg.body?.content : undefined;
			const bodyText = !isHtml ? msg.body?.content : undefined;
			const content = bodyText ?? bodyHtml ?? msg.bodyPreview ?? "";

			const toRecipients = mapRecipients(msg.toRecipients);
			const ccRecipients = mapRecipients(msg.ccRecipients);

			let attachments: RawEmailAttachment[] | undefined;
			if (msg.hasAttachments) {
				try {
					const attRes = await graphFetch(
						accessToken,
						`${GRAPH_BASE}/me/messages/${msg.id}/attachments?$select=id,name,contentType,size,contentId,isInline`,
					);
					if (attRes.ok) {
						const attData = (await attRes.json()) as { value: GraphAttachment[] };
						attachments = attData.value
							.filter((a) => !a.isInline)
							.map((a) => ({
								filename: a.name,
								mimeType: a.contentType,
								size: a.size,
								externalId: `${msg.id}/${a.id}`,
								contentId: a.contentId,
							}));
					}
				} catch {
					// non-critical
				}
			}

			emails.push({
				externalId: msg.id,
				subject: msg.subject ?? "(No Subject)",
				sender: senderName,
				senderEmail,
				recipients: toRecipients.map((r) => r.address),
				toRecipients,
				ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
				content,
				snippet: msg.bodyPreview ?? content.slice(0, 200),
				bodyHtml,
				bodyText,
				attachments: attachments && attachments.length > 0 ? attachments : undefined,
				receivedAt: new Date(msg.receivedDateTime),
				threadId: msg.conversationId,
				messageId: msg.internetMessageId,
			});
		}

		const newCursor = new Date().toISOString();
		return { emails, newCursor };
	},

	async testConnection(credentials: ConnectionCredentials): Promise<boolean> {
		try {
			let accessToken = credentials.accessToken ?? "";
			if (credentials.refreshToken) {
				const refreshed = await refreshAccessToken(credentials.refreshToken);
				accessToken = refreshed.access_token;
			}
			const res = await graphFetch(accessToken, `${GRAPH_BASE}/me`);
			return res.ok;
		} catch {
			return false;
		}
	},
};
