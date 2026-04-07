import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { writeAuditLog } from "../../../lib/audit-log";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
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
	.handler(async ({ input, context }) => {
		const token = await db.apiToken.findUnique({
			where: { id: input.tokenId },
		});

		if (!token) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(
			token.organizationId,
			context.user.id,
		);

		await db.apiToken.update({
			where: { id: input.tokenId },
			data: { isActive: false },
		});

		writeAuditLog({
			organizationId: token.organizationId,
			userId: context.user.id,
			action: "API_TOKEN_REVOKE",
			targetType: "ApiToken",
			targetId: input.tokenId,
			metadata: { name: token.name },
		});

		return { success: true, tokenId: input.tokenId };
	});
