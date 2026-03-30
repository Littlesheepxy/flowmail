import type {
	ConnectionCredentials,
	EmailConnector,
	RawEmail,
	RawEmailAttachment,
	SyncResult,
} from "./types";

const BASE_URL = "https://open.feishu.cn/open-apis";

async function feishuGet(
	path: string,
	token: string,
	params?: Record<string, string>,
): Promise<Record<string, unknown>> {
	const url = new URL(`${BASE_URL}${path}`);
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			if (v) {
				url.searchParams.set(k, v);
			}
		}
	}

	const res = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!res.ok) {
		throw new Error(`Feishu API ${path} failed: ${res.status}`);
	}

	const json = (await res.json()) as Record<string, unknown>;
	const code = json.code as number | undefined;
	if (code !== 0) {
		throw new Error(
			`Feishu API error: code=${code}, msg=${json.msg as string}`,
		);
	}

	return json.data as Record<string, unknown>;
}

interface FeishuAttachment {
	attachment_type?: number;
	filename?: string;
	id?: string;
	size?: number;
	content_type?: string;
}

interface FeishuMessageDetail {
	message_id: string;
	subject?: string;
	head_from?: { mail_address?: string; name?: string };
	to?: Array<{ mail_address?: string; name?: string }>;
	cc?: Array<{ mail_address?: string; name?: string }>;
	body_plain_text?: string;
	body_html?: string;
	internal_date?: string;
	message_state?: number;
	thread_id?: string;
	attachments?: FeishuAttachment[];
}

function decodeBase64(encoded: string): string {
	try {
		return Buffer.from(encoded, "base64").toString("utf-8");
	} catch {
		return encoded;
	}
}

export const feishuConnector: EmailConnector = {
	async fetchNewEmails(
		credentials: ConnectionCredentials,
		cursor?: string | null,
	): Promise<SyncResult> {
		const token = credentials.accessToken;
		if (!token) {
			throw new Error("飞书连接缺少 access_token，请重新授权。");
		}

		const mailboxId = credentials.email || "me";
		const emails: RawEmail[] = [];

		let pageToken = cursor || undefined;
		let fetched = 0;
		const maxEmails = 50;

		while (fetched < maxEmails) {
			const params: Record<string, string> = {
				page_size: "20",
				folder_id: "INBOX",
			};
			if (pageToken) {
				params.page_token = pageToken;
			}

			const data = await feishuGet(
				`/mail/v1/user_mailboxes/${encodeURIComponent(mailboxId)}/messages`,
				token,
				params,
			);

			const items = (data.items as string[]) ?? [];
			if (items.length === 0) {
				break;
			}

			for (const messageId of items) {
				if (fetched >= maxEmails) {
					break;
				}

				try {
					const detail = await feishuGet(
						`/mail/v1/user_mailboxes/${encodeURIComponent(mailboxId)}/messages/${messageId}`,
						token,
						{ format: "full" },
					);

					const wrapper = detail as { message?: Record<string, unknown> };
					const raw = wrapper.message ?? detail;
					const msg = raw as unknown as FeishuMessageDetail;

					if (fetched === 0) {
						console.log("[Feishu] First message subject:", msg.subject);
						console.log("[Feishu] First message from:", JSON.stringify(msg.head_from));
					}

					const from = msg.head_from ?? {};
					const toAddrs = msg.to ?? [];
					const ccAddrs = msg.cc ?? [];

					const rawHtml = msg.body_html ? decodeBase64(msg.body_html) : undefined;
					const rawText = msg.body_plain_text ? decodeBase64(msg.body_plain_text) : undefined;
					const content = rawText || stripHtml(rawHtml ?? "") || "";

					const attachments: RawEmailAttachment[] = (msg.attachments ?? [])
						.filter((a) => a.id)
						.map((a) => ({
							filename: a.filename ?? "attachment",
							mimeType: a.content_type,
							size: a.size,
							externalId: a.id as string,
						}));

					emails.push({
						externalId: msg.message_id || messageId,
						threadId: msg.thread_id ?? undefined,
						subject: msg.subject ?? "(无主题)",
						sender: from.name ?? from.mail_address ?? "",
						senderEmail: from.mail_address ?? "",
						recipients: toAddrs.map((a) => a.mail_address ?? ""),
						toRecipients: toAddrs
							.filter((a) => a.mail_address)
							.map((a) => ({ name: a.name, address: a.mail_address as string })),
						ccRecipients: ccAddrs
							.filter((a) => a.mail_address)
							.map((a) => ({ name: a.name, address: a.mail_address as string })),
						content,
						snippet: content.slice(0, 200),
						bodyHtml: rawHtml,
						bodyText: rawText,
						attachments: attachments.length > 0 ? attachments : undefined,
						receivedAt: msg.internal_date
							? new Date(Number(msg.internal_date))
							: new Date(),
					});
					fetched++;
				} catch (err) {
					console.error(`[Feishu] Failed to fetch message ${messageId}:`, err);
				}
			}

			const hasMore = data.has_more as boolean;
			if (!hasMore) {
				break;
			}
			pageToken = data.page_token as string;
		}

		return {
			emails,
			newCursor: pageToken || new Date().toISOString(),
		};
	},

	async testConnection(credentials: ConnectionCredentials): Promise<boolean> {
		try {
			const token = credentials.accessToken;
			if (!token) {
				return false;
			}
			await feishuGet(
				`/mail/v1/user_mailboxes/${encodeURIComponent(credentials.email || "me")}/messages`,
				token,
				{ page_size: "1", folder_id: "INBOX" },
			);
			return true;
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
