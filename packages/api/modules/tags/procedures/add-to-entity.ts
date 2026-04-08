import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { addTagToEntitySchema } from "../types";

export const addTagToEntity = protectedProcedure
	.route({
		method: "POST",
		path: "/tags/add-to-entity",
		tags: ["Tags"],
		summary: "Add a tag to an entity (by id or create by name)",
	})
	.input(addTagToEntitySchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			select: { id: true, organizationId: true },
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND", { message: "Entity not found" });
		}

		await requireOrgMembershipForResource(entity.organizationId, context.user.id);

		let tagId = input.tagId;

		if (!tagId && input.tagName) {
			const tag = await db.tag.upsert({
				where: {
					organizationId_name: {
						organizationId: entity.organizationId,
						name: input.tagName,
					},
				},
				create: {
					organizationId: entity.organizationId,
					name: input.tagName,
					source: "USER",
				},
				update: {},
			});
			tagId = tag.id;
		}

		if (!tagId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Either tagId or tagName is required",
			});
		}

		const entityTag = await db.entityTag.upsert({
			where: {
				entityId_tagId: {
					entityId: input.entityId,
					tagId,
				},
			},
			create: {
				entityId: input.entityId,
				tagId,
			},
			update: {},
			include: {
				tag: true,
			},
		});

		return entityTag;
	});
