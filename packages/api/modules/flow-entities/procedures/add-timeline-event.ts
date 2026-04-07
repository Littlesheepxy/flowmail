import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { z } from "zod";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";

export const addTimelineEventSchema = z.object({
	entityId: z.string(),
	type: z.enum([
		"email_received",
		"email_sent",
		"status_changed",
		"action_taken",
		"ai_summary",
		"milestone",
		"note",
	]),
	content: z.string().min(1).max(2000),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const addTimelineEvent = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/{entityId}/timeline",
		tags: ["FlowEntities"],
		summary: "Add a timeline event to an entity",
	})
	.input(addTimelineEventSchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			select: { id: true, organizationId: true },
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(
			entity.organizationId,
			context.user.id,
		);

		const event = await db.timelineEvent.create({
			data: {
				entityId: input.entityId,
				type: input.type,
				content: input.content,
				metadata: input.metadata
					? JSON.stringify(input.metadata)
					: null,
				actorId: context.user.id,
			},
			include: {
				actor: { select: { id: true, name: true, image: true } },
			},
		});

		return event;
	});
