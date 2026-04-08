import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { splitEntitySchema } from "../types";

export const splitEntity = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/split",
		tags: ["FlowEntities"],
		summary: "Split selected threads into a new entity",
	})
	.input(splitEntitySchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			include: {
				threads: { select: { id: true } },
				tags: { select: { tagId: true } },
			},
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND", { message: "Entity not found" });
		}

		await requireOrgMembershipForResource(entity.organizationId, context.user.id);

		const allThreadIds = entity.threads.map((t) => t.id);
		const splitIds = input.threadIds.filter((id) => allThreadIds.includes(id));

		if (splitIds.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "No valid threads to split",
			});
		}

		if (splitIds.length === allThreadIds.length) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot split all threads — at least one must remain",
			});
		}

		const splitThreads = await db.emailThread.findMany({
			where: { id: { in: splitIds } },
			orderBy: { receivedAt: "asc" },
			select: { id: true, subject: true, sender: true, snippet: true },
		});

		const firstThread = splitThreads[0];
		const newTitle = firstThread?.subject
			? firstThread.subject.replace(/^(Re:|Fwd:|Fw:|回复：|转发：)\s*/gi, "").trim()
			: "拆分的事项";

		const newEntity = await db.flowEntity.create({
			data: {
				organizationId: entity.organizationId,
				type: entity.type,
				categoryId: entity.categoryId,
				title: newTitle,
				status: entity.status,
				extractedFields: "{}",
				requiresReview: true,
			},
		});

		await db.$transaction([
			db.emailThread.updateMany({
				where: { id: { in: splitIds } },
				data: { entityId: newEntity.id },
			}),
			...(entity.tags.length > 0
				? [db.entityTag.createMany({
						data: entity.tags.map((t) => ({
							entityId: newEntity.id,
							tagId: t.tagId,
						})),
					})]
				: []),
			db.timelineEvent.create({
				data: {
					entityId: newEntity.id,
					type: "entity_split",
					content: `从「${entity.title}」拆分出 ${splitIds.length} 封邮件`,
					metadata: JSON.stringify({
						sourceEntityId: entity.id,
						sourceTitle: entity.title,
						threadIds: splitIds,
					}),
					actorId: context.user.id,
				},
			}),
			db.timelineEvent.create({
				data: {
					entityId: entity.id,
					type: "entity_split",
					content: `${splitIds.length} 封邮件已拆分到新事项「${newTitle}」`,
					metadata: JSON.stringify({
						newEntityId: newEntity.id,
						newTitle,
						threadIds: splitIds,
					}),
					actorId: context.user.id,
				},
			}),
			db.flowEntity.update({
				where: { id: entity.id },
				data: { updatedAt: new Date() },
			}),
		]);

		return { success: true, newEntityId: newEntity.id };
	});
