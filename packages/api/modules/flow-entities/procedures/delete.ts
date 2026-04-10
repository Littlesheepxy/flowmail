import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { z } from "zod";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { writeAuditLog } from "../../../lib/audit-log";
import { protectedProcedure } from "../../../orpc/procedures";

export const deleteEntity = protectedProcedure
	.route({
		method: "DELETE",
		path: "/flow-entities/{entityId}",
		tags: ["FlowEntities"],
		summary: "Delete a flow entity and all associated data",
	})
	.input(z.object({ entityId: z.string() }))
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(entity.organizationId, context.user.id);

		// Cascade delete in order (respecting FK constraints)
		await db.timelineEvent.deleteMany({ where: { entityId: input.entityId } });

		const threads = await db.emailThread.findMany({
			where: { entityId: input.entityId },
			select: { id: true },
		});
		const threadIds = threads.map((t) => t.id);

		if (threadIds.length > 0) {
			await db.emailAttachment.deleteMany({ where: { threadId: { in: threadIds } } });
			await db.emailThread.deleteMany({ where: { id: { in: threadIds } } });
		}

		// Detach inbound emails (FK nullable, entity will be gone)
		await db.inboundEmail.updateMany({
			where: { entityId: input.entityId },
			data: { entityId: null },
		});

		await db.flowEntity.delete({ where: { id: input.entityId } });

		writeAuditLog({
			organizationId: entity.organizationId,
			userId: context.user.id,
			action: "ENTITY_DELETE",
			targetType: "FlowEntity",
			targetId: input.entityId,
			metadata: { title: entity.title, type: entity.type },
		});

		return { success: true };
	});
