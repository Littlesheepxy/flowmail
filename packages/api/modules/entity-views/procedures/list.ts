import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembership, requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { listEntityViewsSchema } from "../types";

export const listEntityViews = protectedProcedure
	.route({
		method: "GET",
		path: "/entity-views",
		tags: ["EntityViews"],
		summary: "List custom views for an entity or category",
	})
	.input(listEntityViewsSchema)
	.handler(async ({ input, context }) => {
		if (!input.entityId && !input.categoryId && !input.organizationId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "必须提供 entityId、categoryId 或 organizationId 之一",
			});
		}

		// 解析 organizationId（如果只给了 entityId / categoryId）
		let organizationId = input.organizationId;
		if (!organizationId && input.entityId) {
			const e = await db.flowEntity.findUnique({
				where: { id: input.entityId },
				select: { organizationId: true, categoryId: true },
			});
			if (!e) {
				throw new ORPCError("NOT_FOUND");
			}
			organizationId = e.organizationId;
		}
		if (!organizationId && input.categoryId) {
			const c = await db.category.findUnique({
				where: { id: input.categoryId },
				select: { organizationId: true },
			});
			if (!c) {
				throw new ORPCError("NOT_FOUND");
			}
			organizationId = c.organizationId;
		}

		await requireOrgMembership(organizationId!, context.user.id);

		// 如果是 entity 维度，自动叠加该 entity 所属 category 的模板视图
		let categoryIdForTemplates = input.categoryId;
		if (input.entityId && !input.categoryId) {
			const e = await db.flowEntity.findUnique({
				where: { id: input.entityId },
				select: { categoryId: true },
			});
			categoryIdForTemplates = e?.categoryId ?? undefined;
		}

		const views = await db.entityView.findMany({
			where: {
				organizationId,
				OR: [
					...(input.entityId ? [{ entityId: input.entityId }] : []),
					...(categoryIdForTemplates ? [{ categoryId: categoryIdForTemplates }] : []),
					...(!input.entityId && input.categoryId ? [{ categoryId: input.categoryId }] : []),
				],
			},
			orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
			select: {
				id: true,
				title: true,
				icon: true,
				isPinned: true,
				sortOrder: true,
				entityId: true,
				categoryId: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		return views;
	});
