import { ImapFlow } from "imapflow";
import type {
	ConnectionCredentials,
	EmailConnector,
	EmailRecipient,
	RawEmail,
	SyncResult,
} from "./types";

const PROVIDER_DEFAULTS: Record<string, { host: string; port: number }> = {
	feishu: { host: "imap.feishu.cn", port: 993 },
	dingtalk: { host: "imap.dingtalk.com", port: 993 },
	wecom: { host: "imap.exmail.qq.com", port: 993 },
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

function parseAddress(addr: { name?: string; address?: string } | undefined): {
	name: string;
	email: string;
} {
	if (!addr) {
		return { name: "", email: "" };
	}
	return {
		name: addr.name ?? addr.address ?? "",
		email: addr.address ?? "",
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

		try {
			await client.connect();
			const lock = await client.getMailboxLock("INBOX");

			try {
				const since = cursor
					? new Date(cursor)
					: new Date(Date.now() - 24 * 60 * 60 * 1000);

				const searchResult = await client.search({ since }, { uid: true });
				const uidList = Array.isArray(searchResult) ? searchResult : [];

				if (uidList.length === 0) {
					return { emails: [], newCursor: new Date().toISOString() };
				}

				const uids = uidList.slice(-50);

				for (const uid of uids) {
					try {
					const rawMsg = await client.fetchOne(
						String(uid),
						{ envelope: true, bodyStructure: true, source: true },
						{ uid: true },
					);
					const msg = rawMsg && typeof rawMsg === "object" ? rawMsg : null;

					if (!msg || !("envelope" in msg) || !msg.envelope) {
						continue;
					}

					const env = msg.envelope as unknown as Record<string, unknown>;
					const msgAny = msg as unknown as Record<string, unknown>;
					const from = parseAddress(
						(env.from as Array<{ name?: string; address?: string }> | undefined)?.[0],
					);
					const toAddrs = (
						env.to as Array<{ name?: string; address?: string }> | undefined
					) ?? [];
					const ccAddrs = (
						env.cc as Array<{ name?: string; address?: string }> | undefined
					) ?? [];

					const sourceObj = msgAny.source as { toString(enc: string): string } | undefined;
					const rawSource = sourceObj?.toString("utf-8") ?? "";
					const { text: bodyText, html: bodyHtml } =
						extractPartsFromSource(rawSource);
					const content = bodyText || stripHtml(bodyHtml) || rawSource.slice(0, 5000);

					const toRecipients: EmailRecipient[] = toAddrs
						.filter((a) => a.address)
						.map((a) => ({ name: a.name, address: a.address as string }));
					const ccRecipients: EmailRecipient[] = ccAddrs
						.filter((a) => a.address)
						.map((a) => ({ name: a.name, address: a.address as string }));

					emails.push({
						externalId: (env.messageId as string) ?? `uid-${uid}`,
						subject: (env.subject as string) ?? "(no subject)",
						sender: from.name,
						senderEmail: from.email,
						recipients: toAddrs.map((a) => a.address ?? ""),
						toRecipients,
						ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
						content,
						snippet: content.slice(0, 200),
						bodyHtml: bodyHtml || undefined,
						bodyText: bodyText || undefined,
						receivedAt: env.date ? new Date(env.date as string) : new Date(),
					});
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

function extractPartsFromSource(source: string): {
	text: string;
	html: string;
} {
	const textMatch = source.match(
		/Content-Type:\s*text\/plain[^\r\n]*\r?\n(?:Content-Transfer-Encoding:\s*[^\r\n]*\r?\n)?(?:[^\r\n]*\r?\n)*?\r?\n([\s\S]*?)(?:\r?\n--)/i,
	);
	const htmlMatch = source.match(
		/Content-Type:\s*text\/html[^\r\n]*\r?\n(?:Content-Transfer-Encoding:\s*[^\r\n]*\r?\n)?(?:[^\r\n]*\r?\n)*?\r?\n([\s\S]*?)(?:\r?\n--)/i,
	);

	let text = textMatch?.[1]?.trim() ?? "";
	const html = htmlMatch?.[1]?.trim() ?? "";

	if (!text && !html) {
		const bodyStart = source.indexOf("\r\n\r\n");
		if (bodyStart !== -1) {
			text = source.slice(bodyStart + 4, bodyStart + 5000).trim();
		}
	}

	return { text, html };
}

function stripHtml(html: string): string {
	return html
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
