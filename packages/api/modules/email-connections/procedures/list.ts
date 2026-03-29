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
			},
			orderBy: { createdAt: "desc" },
		});

		return connections;
	});
