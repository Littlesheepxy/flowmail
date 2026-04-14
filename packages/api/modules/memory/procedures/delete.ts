import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { deleteMemorySchema } from "../types";

export const deleteMemory = protectedProcedure
	.route({
		method: "DELETE",
		path: "/memory/{memoryId}",
		tags: ["Memory"],
		summary: "Delete an agent memory entry",
	})
	.input(deleteMemorySchema)
	.handler(async ({ input, context }) => {
		const memory = await db.agentMemory.findUnique({
			where: { id: input.memoryId },
			select: { organizationId: true },
		});

		if (!memory) {
			throw new ORPCError("NOT_FOUND", { message: "Memory not found" });
		}

		await requireOrgMembershipForResource(memory.organizationId, context.user.id);

		await db.agentMemory.delete({ where: { id: input.memoryId } });

		return { success: true };
	});
