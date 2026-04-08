import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { reclassifyEntitySchema } from "../types";

export const reclassifyEntity = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/{entityId}/reclassify",
		tags: ["FlowEntities"],
		summary: "Manually reclassify an entity",
	})
	.input(reclassifyEntitySchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			select: { id: true, organizationId: true, type: true, categoryId: true },
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND", { message: "Entity not found" });
		}

		await requireOrgMembershipForResource(entity.organizationId, context.user.id);

		let newCategoryId: string | null = entity.categoryId;
		const slug = input.categorySlug ?? input.type.toLowerCase();

		const category = await db.category.findFirst({
			where: { organizationId: entity.organizationId, slug },
			select: { id: true },
		});

		if (category) {
			newCategoryId = category.id;
		}

		const previousType = entity.type;

		const updated = await db.flowEntity.update({
			where: { id: input.entityId },
			data: {
				type: input.type,
				categoryId: newCategoryId,
				updatedAt: new Date(),
			},
		});

		await db.timelineEvent.create({
			data: {
				entityId: input.entityId,
				type: "reclassified",
				content: `手动分类变更：${previousType} → ${input.type}`,
				metadata: JSON.stringify({
					previousType,
					newType: input.type,
					categorySlug: slug,
					categoryId: newCategoryId,
				}),
				actorId: context.user.id,
			},
		});

		return updated;
	});
