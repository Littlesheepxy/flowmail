import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { deleteEntityViewSchema } from "../types";

export const deleteEntityView = protectedProcedure
	.route({
		method: "DELETE",
		path: "/entity-views/{viewId}",
		tags: ["EntityViews"],
		summary: "Delete a custom view",
	})
	.input(deleteEntityViewSchema)
	.handler(async ({ input, context }) => {
		const view = await db.entityView.findUnique({
			where: { id: input.viewId },
			select: { id: true, organizationId: true },
		});
		if (!view) {
			throw new ORPCError("NOT_FOUND");
		}
		await requireOrgMembership(view.organizationId, context.user.id);

		await db.entityView.delete({ where: { id: input.viewId } });
		return { success: true };
	});
