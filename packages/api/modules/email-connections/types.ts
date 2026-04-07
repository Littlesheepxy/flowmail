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
	maxSyncCount: z.number().min(10).max(10000).optional(),
});

export const disconnectSchema = z.object({
	connectionId: z.string(),
});

export const syncConnectionSchema = z.object({
	connectionId: z.string(),
	skipClassification: z
		.boolean()
		.optional()
		.describe("If true, only store emails without AI classification"),
});

export const testConnectionSchema = z.object({
	connectionId: z.string(),
});

export const connectOAuthSchema = z.object({
	organizationId: z.string(),
	provider: z.enum(["feishu", "dingtalk", "wecom"]),
	appId: z.string().min(1),
	appSecret: z.string().min(1),
	authCode: z.string().min(1),
	redirectUri: z.string().url(),
	imapPassword: z.string().optional(),
});

export const connectOutlookSchema = z.object({
	organizationId: z.string(),
	authCode: z.string(),
	redirectUri: z.string().url(),
});

export const updateImapPasswordSchema = z.object({
	connectionId: z.string(),
	imapPassword: z.string().min(1),
});
