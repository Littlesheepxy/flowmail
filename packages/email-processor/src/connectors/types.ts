export interface RawEmailAttachment {
	filename: string;
	mimeType?: string;
	size?: number;
	externalId: string;
	contentId?: string;
	content?: Buffer;
}

export interface EmailRecipient {
	name?: string;
	address: string;
}

export interface RawEmail {
	externalId: string;
	subject: string;
	sender: string;
	senderEmail: string;
	recipients: string[];
	toRecipients?: EmailRecipient[];
	ccRecipients?: EmailRecipient[];
	content: string;
	snippet: string;
	bodyHtml?: string;
	bodyText?: string;
	attachments?: RawEmailAttachment[];
	receivedAt: Date;
	threadId?: string;
	messageId?: string;
	isForwarded?: boolean;
	originalSender?: string;
	originalSenderName?: string;
	originalSubject?: string;
	forwarder?: string;
	forwarderEmail?: string;
}

export interface ConnectionCredentials {
	provider: string;
	email: string;
	accessToken?: string | null;
	refreshToken?: string | null;
	imapHost?: string | null;
	imapPort?: number | null;
	imapPassword?: string | null;
	authType: string;
	maxSyncCount?: number | null;
}

export interface SyncResult {
	emails: RawEmail[];
	newCursor?: string;
}

export interface EmailConnector {
	fetchNewEmails(
		credentials: ConnectionCredentials,
		cursor?: string | null,
	): Promise<SyncResult>;

	testConnection(credentials: ConnectionCredentials): Promise<boolean>;
}
