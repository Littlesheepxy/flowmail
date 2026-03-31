import { db } from "@repo/database";
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
	.handler(async ({ input }) => {
		await db.emailConnection.delete({
			where: { id: input.connectionId },
		});

		return { success: true };
	});
