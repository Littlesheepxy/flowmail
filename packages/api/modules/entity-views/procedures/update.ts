import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateEntityViewSchema } from "../types";

export const updateEntityView = protectedProcedure
	.route({
		method: "PATCH",
		path: "/entity-views/{viewId}",
		tags: ["EntityViews"],
		summary: "Update a custom view",
	})
	.input(updateEntityViewSchema)
	.handler(async ({ input, context }) => {
		const view = await db.entityView.findUnique({
			where: { id: input.viewId },
			select: { id: true, organizationId: true },
		});
		if (!view) {
			throw new ORPCError("NOT_FOUND");
		}
		await requireOrgMembership(view.organizationId, context.user.id);

		const data: Record<string, unknown> = {};
		if (input.title !== undefined) {
			data.title = input.title;
		}
		if (input.icon !== undefined) {
			data.icon = input.icon;
		}
		if (input.spec !== undefined) {
			data.spec = JSON.stringify(input.spec);
		}
		if (input.isPinned !== undefined) {
			data.isPinned = input.isPinned;
		}
		if (input.sortOrder !== undefined) {
			data.sortOrder = input.sortOrder;
		}

		const updated = await db.entityView.update({
			where: { id: input.viewId },
			data,
		});

		return updated;
	});
