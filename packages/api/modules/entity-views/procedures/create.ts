import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { createEntityViewSchema } from "../types";

export const createEntityView = protectedProcedure
	.route({
		method: "POST",
		path: "/entity-views",
		tags: ["EntityViews"],
		summary: "Create a custom view",
	})
	.input(createEntityViewSchema)
	.handler(async ({ input, context }) => {
		// 解析 organizationId
		let organizationId = input.organizationId;
		if (!organizationId && input.entityId) {
			const e = await db.flowEntity.findUnique({
				where: { id: input.entityId },
				select: { organizationId: true },
			});
			if (!e) {
				throw new ORPCError("NOT_FOUND", { message: "Entity not found" });
			}
			organizationId = e.organizationId;
		}
		if (!organizationId && input.categoryId) {
			const c = await db.category.findUnique({
				where: { id: input.categoryId },
				select: { organizationId: true },
			});
			if (!c) {
				throw new ORPCError("NOT_FOUND", { message: "Category not found" });
			}
			organizationId = c.organizationId;
		}
		if (!organizationId) {
			throw new ORPCError("BAD_REQUEST", { message: "无法解析 organizationId" });
		}

		await requireOrgMembership(organizationId, context.user.id);

		const view = await db.entityView.create({
			data: {
				organizationId,
				entityId: input.entityId,
				categoryId: input.categoryId,
				title: input.title,
				icon: input.icon ?? "LayoutDashboardIcon",
				spec: JSON.stringify(input.spec),
				isPinned: input.isPinned ?? false,
				createdById: context.user.id,
			},
		});

		return view;
	});
