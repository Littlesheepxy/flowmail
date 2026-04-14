import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateMemorySchema } from "../types";

export const updateMemory = protectedProcedure
	.route({
		method: "PUT",
		path: "/memory/{memoryId}",
		tags: ["Memory"],
		summary: "Update an agent memory entry",
	})
	.input(updateMemorySchema)
	.handler(async ({ input, context }) => {
		const memory = await db.agentMemory.findUnique({
			where: { id: input.memoryId },
			select: { organizationId: true },
		});

		if (!memory) {
			throw new ORPCError("NOT_FOUND", { message: "Memory not found" });
		}

		await requireOrgMembershipForResource(memory.organizationId, context.user.id);

		const data: Record<string, unknown> = {};
		if (input.content !== undefined) {
			data.content = input.content;
		}
		if (input.importance !== undefined) {
			data.importance = input.importance;
		}

		const updated = await db.agentMemory.update({
			where: { id: input.memoryId },
			data,
		});

		return {
			id: updated.id,
			content: updated.content,
			importance: updated.importance,
			updatedAt: updated.updatedAt.toISOString(),
		};
	});
