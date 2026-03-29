export interface RawEmail {
	externalId: string;
	subject: string;
	sender: string;
	senderEmail: string;
	recipients: string[];
	content: string;
	snippet: string;
	receivedAt: Date;
	threadId?: string;
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
