import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { writeAuditLog } from "../../../lib/audit-log";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { disconnectSchema } from "../types";

export const disconnectEmailConnection = protectedProcedure
	.route({
		method: "POST",
		path: "/email-connections/{connectionId}/disconnect",
		tags: ["EmailConnections"],
		summary: "Disconnect and remove an email connection",
	})
	.input(disconnectSchema)
	.handler(async ({ input, context }) => {
		const connection = await db.emailConnection.findUnique({
			where: { id: input.connectionId },
			select: { organizationId: true },
		});

		if (!connection) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(
			connection.organizationId,
			context.user.id,
		);

		await db.emailConnection.delete({
			where: { id: input.connectionId },
		});

		writeAuditLog({
			organizationId: connection.organizationId,
			userId: context.user.id,
			action: "EMAIL_CONNECTION_DELETE",
			targetType: "EmailConnection",
			targetId: input.connectionId,
		});

		return { success: true };
	});
