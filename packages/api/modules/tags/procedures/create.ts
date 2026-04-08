import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { createTagSchema } from "../types";

export const createTag = protectedProcedure
	.route({
		method: "POST",
		path: "/tags",
		tags: ["Tags"],
		summary: "Create a new tag",
	})
	.input(createTagSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const tag = await db.tag.upsert({
			where: {
				organizationId_name: {
					organizationId: input.organizationId,
					name: input.name,
				},
			},
			create: {
				organizationId: input.organizationId,
				name: input.name,
				color: input.color ?? "#6366f1",
				source: "USER",
			},
			update: {},
		});

		return tag;
	});
