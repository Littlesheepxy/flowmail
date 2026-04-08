import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { listTagsSchema } from "../types";

export const listTags = protectedProcedure
	.route({
		method: "GET",
		path: "/tags",
		tags: ["Tags"],
		summary: "List all tags for an organization",
	})
	.input(listTagsSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const tags = await db.tag.findMany({
			where: { organizationId: input.organizationId },
			include: {
				_count: { select: { entities: true } },
			},
			orderBy: { createdAt: "desc" },
		});

		return tags;
	});
