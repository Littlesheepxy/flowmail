import { ImapFlow } from "imapflow";
import type {
	ConnectionCredentials,
	EmailConnector,
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
	return {
		host: credentials.imapHost ?? defaults?.host ?? "",
		port: credentials.imapPort ?? defaults?.port ?? 993,
		secure: true,
		auth: {
			user: credentials.email,
			pass: credentials.imapPassword ?? "",
		},
		logger: false as const,
	};
}

function parseAddress(addr: { name?: string; address?: string } | undefined): {
	name: string;
	email: string;
} {
	if (!addr) return { name: "", email: "" };
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

				if (searchResult.length === 0) {
					return { emails: [], newCursor: new Date().toISOString() };
				}

				const uids = searchResult.slice(-50);

				for (const uid of uids) {
					try {
						const msg = await client.fetchOne(
							String(uid),
							{ envelope: true, bodyStructure: true, source: true },
							{ uid: true },
						);

						if (!msg?.envelope) continue;

						const env = msg.envelope;
						const from = parseAddress(
							(env.from as Array<{ name?: string; address?: string }> | undefined)?.[0],
						);
						const toAddrs = (
							env.to as Array<{ name?: string; address?: string }> | undefined
						) ?? [];

						const rawSource = msg.source?.toString("utf-8") ?? "";
						const content = extractTextFromSource(rawSource);

						emails.push({
							externalId: env.messageId ?? `uid-${uid}`,
							subject: env.subject ?? "(no subject)",
							sender: from.name,
							senderEmail: from.email,
							recipients: toAddrs.map((a) => a.address ?? ""),
							content,
							snippet: content.slice(0, 200),
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

function extractTextFromSource(source: string): string {
	const textMatch = source.match(
		/Content-Type:\s*text\/plain[^\r\n]*\r?\n(?:Content-Transfer-Encoding:\s*[^\r\n]*\r?\n)?(?:[^\r\n]*\r?\n)*?\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\r?\n\.)/i,
	);
	if (textMatch?.[1]) {
		return textMatch[1].trim();
	}
	const bodyStart = source.indexOf("\r\n\r\n");
	if (bodyStart !== -1) {
		return source.slice(bodyStart + 4, bodyStart + 5000).trim();
	}
	return source.slice(0, 5000);
}
