import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { revokeApiTokenSchema } from "../types";

export const revokeApiToken = protectedProcedure
	.route({
		method: "POST",
		path: "/api-tokens/{tokenId}/revoke",
		tags: ["ApiTokens"],
		summary: "Revoke an API token",
	})
	.input(revokeApiTokenSchema)
	.handler(async ({ input }) => {
		const token = await db.apiToken.findUnique({
			where: { id: input.tokenId },
		});

		if (!token) {
			throw new ORPCError("NOT_FOUND");
		}

		await db.apiToken.update({
			where: { id: input.tokenId },
			data: { isActive: false },
		});

		return { success: true, tokenId: input.tokenId };
	});
