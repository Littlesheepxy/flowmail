import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { listObjectsSchema } from "../types";

export const listObjects = protectedProcedure
	.route({
		method: "GET",
		path: "/memory/objects",
		tags: ["Memory"],
		summary: "List structured memory objects",
	})
	.input(listObjectsSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const where: Record<string, unknown> = {
			organizationId: input.organizationId,
		};

		if (input.objectType) {
			where.objectType = input.objectType;
		}
		if (input.objectId) {
			where.objectId = input.objectId;
		}

		const objects = await db.memoryObject.findMany({
			where,
			orderBy: [{ lastUpdatedAt: "desc" }],
			include: {
				_count: { select: { changeLogs: true } },
			},
		});

		return {
			items: objects.map((o) => ({
				id: o.id,
				objectType: o.objectType,
				objectId: o.objectId,
				name: o.name,
				attributes: o.attributes as Record<string, unknown>,
				relations: o.relations as unknown[] | null,
				changeLogCount: o._count.changeLogs,
				lastUpdatedAt: o.lastUpdatedAt.toISOString(),
				createdAt: o.createdAt.toISOString(),
			})),
			total: objects.length,
		};
	});
