import type {
	ConnectionCredentials,
	EmailConnector,
	EmailRecipient,
	RawEmail,
	RawEmailAttachment,
	SyncResult,
} from "./types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(
	path: string,
	accessToken: string,
	init?: RequestInit,
) {
	const res = await fetch(`${GRAPH_BASE}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			...init?.headers,
		},
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Graph API ${res.status}: ${body}`);
	}

	return res.json();
}

function parseRecipients(
	recipients?: Array<{ emailAddress: { name?: string; address: string } }>,
): EmailRecipient[] {
	if (!recipients) {
		return [];
	}
	return recipients.map((r) => ({
		name: r.emailAddress.name || undefined,
		address: r.emailAddress.address,
	}));
}

function parseAttachments(
	attachments?: Array<{
		id: string;
		name: string;
		contentType?: string;
		size?: number;
		contentId?: string;
		isInline?: boolean;
	}>,
	messageId?: string,
): RawEmailAttachment[] {
	if (!attachments) {
		return [];
	}
	return attachments
		.filter((a) => !a.isInline)
		.map((a) => ({
			filename: a.name,
			mimeType: a.contentType,
			size: a.size,
			externalId: messageId ? `${messageId}/${a.id}` : a.id,
			contentId: a.contentId || undefined,
		}));
}

interface GraphMessage {
	id: string;
	conversationId?: string;
	internetMessageId?: string;
	subject?: string;
	from?: { emailAddress: { name?: string; address: string } };
	toRecipients?: Array<{ emailAddress: { name?: string; address: string } }>;
	ccRecipients?: Array<{ emailAddress: { name?: string; address: string } }>;
	body?: { contentType: string; content: string };
	bodyPreview?: string;
	receivedDateTime?: string;
	hasAttachments?: boolean;
}

interface GraphListResponse {
	value: GraphMessage[];
	"@odata.nextLink"?: string;
}

export const outlookConnector: EmailConnector = {
	async fetchNewEmails(
		credentials: ConnectionCredentials,
		cursor?: string | null,
	): Promise<SyncResult> {
		if (!credentials.accessToken) {
			throw new Error("Outlook connector requires an access token");
		}

		const maxTotal = credentials.maxSyncCount ?? 200;
		const perPage = Math.min(maxTotal, 50);

		let filter = "";
		if (cursor) {
			filter = `&$filter=receivedDateTime gt ${cursor}`;
		}

		const allMessages: GraphMessage[] = [];
		let nextLink: string | null =
			`/me/messages?$top=${perPage}&$orderby=receivedDateTime desc&$select=id,conversationId,internetMessageId,subject,from,toRecipients,ccRecipients,body,bodyPreview,receivedDateTime,hasAttachments${filter}`;

		while (nextLink && allMessages.length < maxTotal) {
			const isFullUrl = nextLink.startsWith("http");
			const data: GraphListResponse = isFullUrl
				? await (
						await fetch(nextLink, {
							headers: {
								Authorization: `Bearer ${credentials.accessToken}`,
							},
						})
					).json()
				: await graphFetch(nextLink, credentials.accessToken);

			allMessages.push(...data.value);

			const oDataNext = data["@odata.nextLink"];
			nextLink =
				oDataNext && allMessages.length < maxTotal ? oDataNext : null;
		}

		const messages = allMessages.slice(0, maxTotal);
		const emails: RawEmail[] = [];

		for (const msg of messages) {
			const from = msg.from?.emailAddress;
			const bodyContent = msg.body?.content ?? "";
			const isHtml = msg.body?.contentType === "html";
			const bodyText = isHtml ? stripHtml(bodyContent) : bodyContent;
			const bodyHtml = isHtml ? bodyContent : undefined;

			let attachments: RawEmailAttachment[] = [];
			if (msg.hasAttachments) {
				try {
					const attData = await graphFetch(
						`/me/messages/${msg.id}/attachments?$select=id,name,contentType,size,contentId,isInline`,
						credentials.accessToken,
					);
					attachments = parseAttachments(attData.value, msg.id);
				} catch {
					// non-fatal
				}
			}

			const toRecipients = parseRecipients(msg.toRecipients);
			const ccRecipients = parseRecipients(msg.ccRecipients);

			emails.push({
				externalId: msg.id,
				subject: msg.subject ?? "(No Subject)",
				sender: from?.name ?? from?.address ?? "Unknown",
				senderEmail: from?.address ?? "",
				recipients: toRecipients.map((r) => r.address),
				toRecipients,
				ccRecipients:
					ccRecipients.length > 0 ? ccRecipients : undefined,
				content: bodyText,
				snippet: msg.bodyPreview ?? "",
				bodyHtml,
				bodyText: bodyText || undefined,
				attachments: attachments.length > 0 ? attachments : undefined,
				receivedAt: msg.receivedDateTime
					? new Date(msg.receivedDateTime)
					: new Date(),
				threadId: msg.conversationId ?? undefined,
				messageId: msg.internetMessageId ?? undefined,
			});
		}

		const newCursor = new Date().toISOString();

		return { emails, newCursor };
	},

	async testConnection(credentials: ConnectionCredentials): Promise<boolean> {
		if (!credentials.accessToken) {
			return false;
		}
		try {
			const profile = await graphFetch("/me", credentials.accessToken);
			return !!profile.mail || !!profile.userPrincipalName;
		} catch {
			return false;
		}
	},
};

function stripHtml(html: string): string {
	return html
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/\s+/g, " ")
		.trim();
}
