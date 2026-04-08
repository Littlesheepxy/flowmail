import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { mergeEntitiesSchema } from "../types";

export const mergeEntities = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/merge",
		tags: ["FlowEntities"],
		summary: "Merge source entity into target entity",
	})
	.input(mergeEntitiesSchema)
	.handler(async ({ input, context }) => {
		const [target, source] = await Promise.all([
			db.flowEntity.findUnique({
				where: { id: input.targetEntityId },
				select: { id: true, organizationId: true, title: true },
			}),
			db.flowEntity.findUnique({
				where: { id: input.sourceEntityId },
				include: {
					threads: { select: { id: true } },
					timeline: { select: { id: true } },
					tags: { select: { id: true, tagId: true } },
					inboundEmails: { select: { id: true } },
				},
			}),
		]);

		if (!target || !source) {
			throw new ORPCError("NOT_FOUND", { message: "Entity not found" });
		}

		if (target.organizationId !== source.organizationId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot merge entities from different organizations",
			});
		}

		await requireOrgMembershipForResource(target.organizationId, context.user.id);

		const threadIds = source.threads.map((t) => t.id);
		const timelineIds = source.timeline.map((t) => t.id);
		const inboundIds = source.inboundEmails.map((e) => e.id);

		const existingTargetTags = await db.entityTag.findMany({
			where: { entityId: input.targetEntityId },
			select: { tagId: true },
		});
		const existingTagIds = new Set(existingTargetTags.map((t) => t.tagId));
		const newTagIds = source.tags
			.map((t) => t.tagId)
			.filter((id) => !existingTagIds.has(id));

		await db.$transaction([
			...(threadIds.length > 0
				? [db.emailThread.updateMany({ where: { id: { in: threadIds } }, data: { entityId: input.targetEntityId } })]
				: []),
			...(timelineIds.length > 0
				? [db.timelineEvent.updateMany({ where: { id: { in: timelineIds } }, data: { entityId: input.targetEntityId } })]
				: []),
			...(inboundIds.length > 0
				? [db.inboundEmail.updateMany({ where: { id: { in: inboundIds } }, data: { entityId: input.targetEntityId } })]
				: []),
			...(source.tags.length > 0
				? [db.entityTag.deleteMany({ where: { entityId: input.sourceEntityId } })]
				: []),
			...(newTagIds.length > 0
				? [db.entityTag.createMany({
						data: newTagIds.map((tagId) => ({
							entityId: input.targetEntityId,
							tagId,
						})),
					})]
				: []),
			db.timelineEvent.create({
				data: {
					entityId: input.targetEntityId,
					type: "entity_merged",
					content: `已合并事项「${source.title}」的 ${threadIds.length} 封邮件和 ${timelineIds.length} 条动态`,
					metadata: JSON.stringify({
						sourceEntityId: input.sourceEntityId,
						sourceTitle: source.title,
						threadsMoved: threadIds.length,
						timelineMoved: timelineIds.length,
					}),
					actorId: context.user.id,
				},
			}),
			db.flowEntity.delete({ where: { id: input.sourceEntityId } }),
			db.flowEntity.update({
				where: { id: input.targetEntityId },
				data: { updatedAt: new Date() },
			}),
		]);

		return { success: true, targetEntityId: input.targetEntityId };
	});
