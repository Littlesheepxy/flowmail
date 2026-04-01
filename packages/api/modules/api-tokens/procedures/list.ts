import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { listApiTokensSchema } from "../types";

export const listApiTokens = protectedProcedure
	.route({
		method: "GET",
		path: "/api-tokens",
		tags: ["ApiTokens"],
		summary: "List API tokens for an organization",
	})
	.input(listApiTokensSchema)
	.handler(async ({ input }) => {
		const tokens = await db.apiToken.findMany({
			where: { organizationId: input.organizationId },
			select: {
				id: true,
				name: true,
				tokenPrefix: true,
				scopes: true,
				isActive: true,
				lastUsedAt: true,
				expiresAt: true,
				createdAt: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return tokens.map((t) => ({
			id: t.id,
			name: t.name,
			prefix: t.tokenPrefix,
			scopes: t.scopes,
			isActive: t.isActive,
			lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
			expiresAt: t.expiresAt?.toISOString() ?? null,
			createdAt: t.createdAt.toISOString(),
		}));
	});
