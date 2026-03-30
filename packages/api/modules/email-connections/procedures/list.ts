import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { listConnectionsSchema } from "../types";

export const listEmailConnections = protectedProcedure
	.route({
		method: "GET",
		path: "/email-connections",
		tags: ["EmailConnections"],
		summary: "List email connections for an organization",
	})
	.input(listConnectionsSchema)
	.handler(async ({ input }) => {
		const connections = await db.emailConnection.findMany({
			where: { organizationId: input.organizationId },
			select: {
				id: true,
				provider: true,
				email: true,
				isActive: true,
				lastSyncAt: true,
				createdAt: true,
				authType: true,
				imapPassword: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return connections.map((c) => ({
			id: c.id,
			provider: c.provider,
			email: c.email,
			isActive: c.isActive,
			lastSyncAt: c.lastSyncAt,
			createdAt: c.createdAt,
			authType: c.authType,
			hasImapPassword: !!c.imapPassword,
		}));
	});
