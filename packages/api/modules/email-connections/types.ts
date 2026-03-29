import { z } from "zod";

export const listConnectionsSchema = z.object({
	organizationId: z.string(),
});

export const connectGmailSchema = z.object({
	organizationId: z.string(),
	authCode: z.string(),
	redirectUri: z.string().url(),
});

export const connectImapSchema = z.object({
	organizationId: z.string(),
	provider: z.enum(["feishu", "dingtalk", "wecom", "imap"]),
	email: z.string().email(),
	password: z.string().min(1),
	imapHost: z.string().optional(),
	imapPort: z.number().optional(),
	smtpHost: z.string().optional(),
	smtpPort: z.number().optional(),
});

export const disconnectSchema = z.object({
	connectionId: z.string(),
});

export const syncConnectionSchema = z.object({
	connectionId: z.string(),
});

export const testConnectionSchema = z.object({
	connectionId: z.string(),
});
