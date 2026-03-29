import { gmailConnector } from "./gmail";
import { imapConnector } from "./imap";
import type { EmailConnector } from "./types";

export type { ConnectionCredentials, EmailConnector, RawEmail, SyncResult } from "./types";

const connectorMap: Record<string, EmailConnector> = {
	gmail: gmailConnector,
	feishu: imapConnector,
	dingtalk: imapConnector,
	wecom: imapConnector,
	imap: imapConnector,
};

export function getConnector(provider: string): EmailConnector {
	const connector = connectorMap[provider];
	if (!connector) {
		throw new Error(`Unsupported email provider: ${provider}`);
	}
	return connector;
}
