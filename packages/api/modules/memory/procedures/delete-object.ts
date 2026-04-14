import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { deleteObjectSchema } from "../types";

export const deleteObject = protectedProcedure
	.route({
		method: "DELETE",
		path: "/memory/objects/{objectId}",
		tags: ["Memory"],
		summary: "Delete a memory object",
	})
	.input(deleteObjectSchema)
	.handler(async ({ input, context }) => {
		const obj = await db.memoryObject.findUnique({
			where: { id: input.objectId },
			select: { organizationId: true },
		});

		if (!obj) {
			throw new ORPCError("NOT_FOUND", { message: "Memory object not found" });
		}

		await requireOrgMembershipForResource(obj.organizationId, context.user.id);

		await db.agentMemory.updateMany({
			where: { memoryObjectId: input.objectId },
			data: { memoryObjectId: null },
		});

		await db.memoryObject.delete({ where: { id: input.objectId } });

		return { success: true };
	});
