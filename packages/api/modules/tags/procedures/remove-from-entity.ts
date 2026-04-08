import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { removeTagFromEntitySchema } from "../types";

export const removeTagFromEntity = protectedProcedure
	.route({
		method: "POST",
		path: "/tags/remove-from-entity",
		tags: ["Tags"],
		summary: "Remove a tag from an entity",
	})
	.input(removeTagFromEntitySchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			select: { id: true, organizationId: true },
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND", { message: "Entity not found" });
		}

		await requireOrgMembershipForResource(entity.organizationId, context.user.id);

		await db.entityTag.deleteMany({
			where: {
				entityId: input.entityId,
				tagId: input.tagId,
			},
		});

		return { success: true };
	});
