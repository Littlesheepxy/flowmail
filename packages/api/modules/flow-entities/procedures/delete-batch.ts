import { db } from "@repo/database";
import { z } from "zod";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";

export const deleteBatch = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/delete-batch",
		tags: ["FlowEntities"],
		summary: "Delete multiple flow entities and all associated data",
	})
	.input(
		z.object({
			organizationId: z.string(),
			entityIds: z.array(z.string()).min(1).max(100),
		}),
	)
	.handler(async ({ input, context }) => {
		await requireOrgMembershipForResource(input.organizationId, context.user.id);

		const entities = await db.flowEntity.findMany({
			where: {
				id: { in: input.entityIds },
				organizationId: input.organizationId,
			},
			select: { id: true },
		});

		const ids = entities.map((e) => e.id);
		if (ids.length === 0) {
			return { deleted: 0 };
		}

		await db.timelineEvent.deleteMany({ where: { entityId: { in: ids } } });

		const threads = await db.emailThread.findMany({
			where: { entityId: { in: ids } },
			select: { id: true },
		});
		const threadIds = threads.map((t) => t.id);

		if (threadIds.length > 0) {
			await db.emailAttachment.deleteMany({ where: { threadId: { in: threadIds } } });
			await db.emailThread.deleteMany({ where: { id: { in: threadIds } } });
		}

		await db.inboundEmail.updateMany({
			where: { entityId: { in: ids } },
			data: { entityId: null },
		});

		await db.flowEntity.deleteMany({ where: { id: { in: ids } } });

		return { deleted: ids.length };
	});
