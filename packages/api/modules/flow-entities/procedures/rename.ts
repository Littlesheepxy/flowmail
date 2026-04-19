import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { renameEntitySchema } from "../types";

export const renameEntity = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/{entityId}/rename",
		tags: ["FlowEntities"],
		summary: "重命名事项标题（用户自定义，不被 AI 覆盖）",
	})
	.input(renameEntitySchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			select: { id: true, organizationId: true, title: true },
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND", { message: "Entity not found" });
		}

		await requireOrgMembershipForResource(
			entity.organizationId,
			context.user.id,
		);

		const newTitle = input.title.trim();
		if (!newTitle) {
			throw new ORPCError("BAD_REQUEST", { message: "标题不能为空" });
		}
		if (newTitle === entity.title) {
			return { id: entity.id, title: entity.title, changed: false };
		}

		const updated = await db.flowEntity.update({
			where: { id: input.entityId },
			data: { title: newTitle, updatedAt: new Date() },
			select: { id: true, title: true },
		});

		// 记一条 timeline 让用户能看到改名历史
		await db.timelineEvent.create({
			data: {
				entityId: input.entityId,
				type: "title_changed",
				content: `事项标题改为「${newTitle}」（原：${entity.title}）`,
				metadata: JSON.stringify({
					previousTitle: entity.title,
					newTitle,
				}),
				actorId: context.user.id,
			},
		});

		return { ...updated, changed: true };
	});
