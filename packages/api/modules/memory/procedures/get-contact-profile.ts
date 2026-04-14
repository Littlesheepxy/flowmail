import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { getContactProfileSchema } from "../types";

export const getContactProfile = protectedProcedure
	.route({
		method: "GET",
		path: "/memory/contact-profile",
		tags: ["Memory"],
		summary: "Get aggregated memory profile for a contact",
	})
	.input(getContactProfileSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const memories = await db.agentMemory.findMany({
			where: {
				organizationId: input.organizationId,
				scope: "contact",
				scopeId: input.contactEmail,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
			orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
			take: 20,
		});

		if (memories.length === 0) {
			return { contactEmail: input.contactEmail, memories: [], count: 0 };
		}

		return {
			contactEmail: input.contactEmail,
			count: memories.length,
			memories: memories.map((m) => ({
				id: m.id,
				category: m.category,
				content: m.content,
				importance: m.importance,
				createdAt: m.createdAt.toISOString(),
				metadata: m.metadata ? JSON.parse(m.metadata) : null,
			})),
		};
	});
