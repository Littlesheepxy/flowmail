import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { deleteTagSchema } from "../types";

export const deleteTag = protectedProcedure
	.route({
		method: "POST",
		path: "/tags/delete",
		tags: ["Tags"],
		summary: "Delete a tag",
	})
	.input(deleteTagSchema)
	.handler(async ({ input, context }) => {
		const tag = await db.tag.findUnique({
			where: { id: input.tagId },
			select: { id: true, organizationId: true },
		});

		if (!tag) {
			throw new ORPCError("NOT_FOUND", { message: "Tag not found" });
		}

		await requireOrgMembershipForResource(tag.organizationId, context.user.id);

		await db.tag.delete({ where: { id: input.tagId } });

		return { success: true };
	});
