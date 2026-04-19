import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { getEntityViewSchema, ViewSpecSchema } from "../types";

export const getEntityView = protectedProcedure
	.route({
		method: "GET",
		path: "/entity-views/{viewId}",
		tags: ["EntityViews"],
		summary: "Get a single entity view by id",
	})
	.input(getEntityViewSchema)
	.handler(async ({ input, context }) => {
		const view = await db.entityView.findUnique({
			where: { id: input.viewId },
		});
		if (!view) {
			throw new ORPCError("NOT_FOUND");
		}
		await requireOrgMembership(view.organizationId, context.user.id);

		// 反序列化并 best-effort 校验 spec
		let parsedSpec: ReturnType<typeof ViewSpecSchema.parse>;
		try {
			parsedSpec = ViewSpecSchema.parse(JSON.parse(view.spec));
		} catch {
			parsedSpec = { blocks: [] };
		}

		return {
			...view,
			spec: parsedSpec,
		};
	});
