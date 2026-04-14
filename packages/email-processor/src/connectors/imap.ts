import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type {
	ConnectionCredentials,
	EmailConnector,
	EmailRecipient,
	RawEmail,
	RawEmailAttachment,
	SyncResult,
} from "./types";
import { unwrapForwardedEmail } from "../unwrap-forward";

const PROVIDER_DEFAULTS: Record<string, { host: string; port: number }> = {
	feishu: { host: "imap.feishu.cn", port: 993 },
	dingtalk: { host: "imap.dingtalk.com", port: 993 },
	wecom: { host: "imap.exmail.qq.com", port: 993 },
	netease: { host: "imap.163.com", port: 993 },
	imap: { host: "", port: 993 },
};

function buildImapConfig(credentials: ConnectionCredentials) {
	const defaults = PROVIDER_DEFAULTS[credentials.provider];

	if (!credentials.imapPassword) {
		throw new Error(
			"IMAP 密码未设置。请在「邮箱连接」页面中为此连接配置 IMAP 专用密码后再同步。",
		);
	}

	return {
		host: credentials.imapHost ?? defaults?.host ?? "",
		port: credentials.imapPort ?? defaults?.port ?? 993,
		secure: true,
		auth: {
			user: credentials.email,
			pass: credentials.imapPassword,
		},
		logger: false as const,
	};
}

export const imapConnector: EmailConnector = {
	async fetchNewEmails(
		credentials: ConnectionCredentials,
		cursor?: string | null,
	): Promise<SyncResult> {
		const config = buildImapConfig(credentials);
		const client = new ImapFlow(config);
		const emails: RawEmail[] = [];
		const maxCount = credentials.maxSyncCount ?? 500;

		try {
			await client.connect();
			const lock = await client.getMailboxLock("INBOX");

			try {
				let searchResult: number[];

				if (cursor) {
					const since = new Date(cursor);
					searchResult = await client.search({ since }, { uid: true }) as number[];
				} else {
					searchResult = await client.search({ all: true }, { uid: true }) as number[];
				}

				const uidList = Array.isArray(searchResult) ? searchResult : [];

				if (uidList.length === 0) {
					return { emails: [], newCursor: new Date().toISOString() };
				}

				const uids = uidList.length <= maxCount
					? uidList
					: uidList.slice(-maxCount);

				for (const uid of uids) {
					try {
					const rawMsg = await client.fetchOne(
						String(uid),
						{ envelope: true, source: true },
						{ uid: true },
					);
					const msg = rawMsg && typeof rawMsg === "object" ? rawMsg : null;

					if (!msg || !("envelope" in msg) || !msg.envelope) {
						continue;
					}

					const env = msg.envelope as unknown as Record<string, unknown>;
					const msgAny = msg as unknown as Record<string, unknown>;
					const sourceObj = msgAny.source as Buffer | { toString(enc: string): string } | undefined;
					const rawSource = Buffer.isBuffer(sourceObj)
						? sourceObj
						: Buffer.from(sourceObj?.toString("utf-8") ?? "");

					const parsed = await simpleParser(rawSource);

					const from = parsed.from?.value?.[0];
					const fromName = from?.name ?? from?.address ?? "";
					const fromEmail = from?.address ?? "";

					const toAddrs = parsed.to
						? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap(
								(a) => a.value,
							)
						: [];
					const ccAddrs = parsed.cc
						? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap(
								(a) => a.value,
							)
						: [];

					const bodyText = parsed.text ?? "";
					const bodyHtml = (typeof parsed.html === "string" ? parsed.html : "") || (typeof parsed.textAsHtml === "string" ? parsed.textAsHtml : "");
					const content = bodyText || stripHtml(bodyHtml);

					const toRecipients: EmailRecipient[] = toAddrs
						.filter((a) => a.address)
						.map((a) => ({ name: a.name, address: a.address as string }));
					const ccRecipients: EmailRecipient[] = ccAddrs
						.filter((a) => a.address)
						.map((a) => ({ name: a.name, address: a.address as string }));

					const rfcMessageId =
						parsed.messageId ??
						(env.messageId as string | undefined);

					const attachments: RawEmailAttachment[] = (parsed.attachments ?? [])
						.filter((att) => att.filename)
						.map((att) => ({
							filename: att.filename ?? "untitled",
							mimeType: att.contentType,
							size: att.size,
							externalId: att.contentId ?? att.checksum ?? `${rfcMessageId ?? uid}-${att.filename}`,
							contentId: att.contentId ?? undefined,
							content: att.content,
						}));

					const subject = parsed.subject ?? (env.subject as string) ?? "(no subject)";
					const unwrapped = unwrapForwardedEmail({
						subject,
						sender: fromName,
						senderEmail: fromEmail,
						content,
						bodyText: bodyText || undefined,
					});

					const emailData: RawEmail = {
						externalId: rfcMessageId ?? `uid-${uid}`,
						subject,
						sender: fromName,
						senderEmail: fromEmail,
						recipients: toAddrs.map((a) => a.address ?? ""),
						toRecipients,
						ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
						content,
						snippet: content.slice(0, 200),
						bodyHtml: bodyHtml || undefined,
						bodyText: bodyText || undefined,
						attachments: attachments.length > 0 ? attachments : undefined,
						receivedAt: parsed.date ?? (env.date ? new Date(env.date as string) : new Date()),
						messageId: rfcMessageId || undefined,
					};

					if (unwrapped.isForwarded) {
						emailData.isForwarded = true;
						emailData.originalSender = unwrapped.originalSender;
						emailData.originalSenderName = unwrapped.originalSenderName;
						emailData.originalSubject = unwrapped.originalSubject;
						emailData.forwarder = unwrapped.forwarder;
						emailData.forwarderEmail = unwrapped.forwarderEmail;
						if (unwrapped.cleanBody) {
							emailData.content = unwrapped.cleanBody;
							emailData.snippet = unwrapped.cleanBody.slice(0, 200);
						}
					}

					emails.push(emailData);
					} catch {
						// skip individual message errors
					}
				}
			} finally {
				lock.release();
			}

			await client.logout();
		} catch (err) {
			try { await client.logout(); } catch { /* ignore */ }
			throw err;
		}

		const newCursor = new Date().toISOString();
		return { emails, newCursor };
	},

	async testConnection(credentials: ConnectionCredentials): Promise<boolean> {
		const config = buildImapConfig(credentials);
		const client = new ImapFlow(config);

		try {
			await client.connect();
			await client.logout();
			return true;
		} catch {
			try { await client.logout(); } catch { /* ignore */ }
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
		.replace(/\s+/g, " ")
		.trim();
}
