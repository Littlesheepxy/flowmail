import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { writeAuditLog } from "../../../lib/audit-log";
import { protectedProcedure } from "../../../orpc/procedures";
import { generateRawToken, hashToken, extractPrefix } from "../lib/token-utils";
import { createApiTokenSchema } from "../types";

export const createApiToken = protectedProcedure
	.route({
		method: "POST",
		path: "/api-tokens",
		tags: ["ApiTokens"],
		summary: "Create a new API token for MCP / Agent access",
	})
	.input(createApiTokenSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);
		const rawToken = generateRawToken();
		const tokenHash = hashToken(rawToken);
		const tokenPrefix = extractPrefix(rawToken);

		const expiresAt = input.expiresInDays
			? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
			: null;

		const token = await db.apiToken.create({
			data: {
				organizationId: input.organizationId,
				name: input.name,
				tokenHash,
				tokenPrefix,
				scopes: input.scopes ?? "mcp:full",
				expiresAt,
			},
		});

		writeAuditLog({
			organizationId: input.organizationId,
			userId: context.user.id,
			action: "API_TOKEN_CREATE",
			targetType: "ApiToken",
			targetId: token.id,
			metadata: { name: input.name, scopes: token.scopes },
		});

		return {
			id: token.id,
			name: token.name,
			token: rawToken,
			prefix: tokenPrefix,
			scopes: token.scopes,
			expiresAt: token.expiresAt?.toISOString() ?? null,
			createdAt: token.createdAt.toISOString(),
		};
	});
