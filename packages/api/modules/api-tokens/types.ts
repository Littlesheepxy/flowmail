import { z } from "zod";

export const createApiTokenSchema = z.object({
	organizationId: z.string(),
	name: z.string().min(1).max(100),
	scopes: z.string().optional().default("mcp:full"),
	expiresInDays: z.number().min(1).max(365).optional(),
});

export const listApiTokensSchema = z.object({
	organizationId: z.string(),
});

export const revokeApiTokenSchema = z.object({
	tokenId: z.string(),
});
