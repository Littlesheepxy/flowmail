import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { listMemoriesSchema } from "../types";

export const listMemories = protectedProcedure
	.route({
		method: "GET",
		path: "/memory",
		tags: ["Memory"],
		summary: "List agent memories for an organization",
	})
	.input(listMemoriesSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const where: Record<string, unknown> = {
			organizationId: input.organizationId,
		};

		if (input.category) {
			where.category = input.category;
		}
		if (input.scope) {
			where.scope = input.scope;
		}
		if (input.scopeId) {
			where.scopeId = input.scopeId;
		}

		const now = new Date();
		where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];

		if (input.cursor) {
			where.createdAt = { lt: new Date(input.cursor) };
		}

		const memories = await db.agentMemory.findMany({
			where,
			orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
			take: input.limit + 1,
		});

		const hasMore = memories.length > input.limit;
		const items = hasMore ? memories.slice(0, input.limit) : memories;
		const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

		const total = await db.agentMemory.count({ where: { organizationId: input.organizationId } });

		return {
			items: items.map((m) => ({
				id: m.id,
				category: m.category,
				scope: m.scope,
				scopeId: m.scopeId,
				content: m.content,
				metadata: m.metadata ? JSON.parse(m.metadata) : null,
				importance: m.importance,
				accessCount: m.accessCount,
				lastAccessedAt: m.lastAccessedAt?.toISOString() ?? null,
				createdAt: m.createdAt.toISOString(),
				updatedAt: m.updatedAt.toISOString(),
			})),
			nextCursor,
			total,
		};
	});
