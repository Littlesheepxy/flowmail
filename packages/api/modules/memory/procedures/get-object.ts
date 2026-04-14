import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { getObjectSchema, getObjectHistorySchema } from "../types";

export const getObject = protectedProcedure
	.route({
		method: "GET",
		path: "/memory/objects/{objectId}",
		tags: ["Memory"],
		summary: "Get a memory object with its change history",
	})
	.input(getObjectSchema)
	.handler(async ({ input, context }) => {
		const obj = await db.memoryObject.findUnique({
			where: { id: input.objectId },
			include: {
				changeLogs: {
					orderBy: { createdAt: "desc" },
					take: 20,
					select: {
						id: true,
						content: true,
						importance: true,
						createdAt: true,
					},
				},
				_count: { select: { changeLogs: true } },
			},
		});

		if (!obj) {
			throw new ORPCError("NOT_FOUND", { message: "Memory object not found" });
		}

		await requireOrgMembershipForResource(obj.organizationId, context.user.id);

		return {
			id: obj.id,
			objectType: obj.objectType,
			objectId: obj.objectId,
			name: obj.name,
			attributes: obj.attributes as Record<string, unknown>,
			relations: obj.relations as unknown[] | null,
			changeLogCount: obj._count.changeLogs,
			changeLogs: obj.changeLogs.map((l) => ({
				id: l.id,
				content: l.content,
				importance: l.importance,
				createdAt: l.createdAt.toISOString(),
			})),
			lastUpdatedAt: obj.lastUpdatedAt.toISOString(),
			createdAt: obj.createdAt.toISOString(),
		};
	});

export const getObjectHistory = protectedProcedure
	.route({
		method: "GET",
		path: "/memory/objects/{objectId}/history",
		tags: ["Memory"],
		summary: "Get change history for a memory object",
	})
	.input(getObjectHistorySchema)
	.handler(async ({ input, context }) => {
		const obj = await db.memoryObject.findUnique({
			where: { id: input.objectId },
			select: { organizationId: true },
		});

		if (!obj) {
			throw new ORPCError("NOT_FOUND", { message: "Memory object not found" });
		}

		await requireOrgMembershipForResource(obj.organizationId, context.user.id);

		const logs = await db.agentMemory.findMany({
			where: { memoryObjectId: input.objectId },
			orderBy: { createdAt: "desc" },
			take: input.limit,
			select: {
				id: true,
				content: true,
				category: true,
				importance: true,
				createdAt: true,
			},
		});

		return {
			items: logs.map((l) => ({
				id: l.id,
				content: l.content,
				category: l.category,
				importance: l.importance,
				createdAt: l.createdAt.toISOString(),
			})),
		};
	});
