import { feishuConnector } from "./feishu";
import { gmailConnector } from "./gmail";
import { imapConnector } from "./imap";
import { outlookConnector } from "./outlook";
import type { EmailConnector } from "./types";

export type { ConnectionCredentials, EmailConnector, EmailRecipient, RawEmail, RawEmailAttachment, SyncResult } from "./types";

const connectorMap: Record<string, EmailConnector> = {
	gmail: gmailConnector,
	outlook: outlookConnector,
	feishu: feishuConnector,
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
