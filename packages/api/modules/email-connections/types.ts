import { z } from "zod";

export const listConnectionsSchema = z.object({
	organizationId: z.string(),
});

export const connectGmailSchema = z.object({
	organizationId: z.string(),
	authCode: z.string(),
	redirectUri: z.string().url(),
});

export const disconnectSchema = z.object({
	connectionId: z.string(),
});
