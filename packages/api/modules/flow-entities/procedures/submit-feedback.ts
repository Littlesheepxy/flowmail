import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { submitFeedbackSchema } from "../types";

export const submitFeedback = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/{entityId}/feedback",
		tags: ["FlowEntities"],
		summary: "Submit user feedback (thumbs up/down) on AI decisions",
	})
	.input(submitFeedbackSchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(
			entity.organizationId,
			context.user.id,
		);

		const isPositive = input.feedbackType === "thumbs_up";
		const importance = isPositive ? 5 : 8;

		let content = `用户对 "${entity.title}" 的${targetLabel(input.target)}`;
		content += isPositive ? "表示认可" : "表示不满";
		if (input.correction) {
			content += `，修正为: ${input.correction}`;
		}
		if (input.comment) {
			content += `（备注: ${input.comment}）`;
		}

		await db.agentMemory.create({
			data: {
				organizationId: entity.organizationId,
				category: "decision_record",
				scope: "project",
				scopeId: input.entityId,
				content,
				metadata: JSON.stringify({
					entityId: input.entityId,
					entityTitle: entity.title,
					feedbackType: input.feedbackType,
					target: input.target,
					correction: input.correction,
					comment: input.comment,
					userId: context.user.id,
					userApproved: isPositive,
				}),
				importance,
			},
		});

		if (
			input.target === "classification" &&
			!isPositive &&
			input.correction
		) {
			await db.agentMemory.create({
				data: {
					organizationId: entity.organizationId,
					category: "classification_learning",
					scope: "org",
					content: `用户将 "${entity.title}" 的分类从 ${entity.type} 修正为 ${input.correction}`,
					metadata: JSON.stringify({
						entityId: input.entityId,
						originalType: entity.type,
						correctedTo: input.correction,
						userId: context.user.id,
					}),
					importance: 9,
				},
			});
		}

		await db.timelineEvent.create({
			data: {
				entityId: input.entityId,
				type: "action_taken",
				content: `用户反馈: ${isPositive ? "👍" : "👎"} ${targetLabel(input.target)}${input.correction ? ` → ${input.correction}` : ""}`,
				metadata: JSON.stringify({
					action: "user_feedback",
					feedbackType: input.feedbackType,
					target: input.target,
					correction: input.correction,
					comment: input.comment,
				}),
				actorId: context.user.id,
			},
		});

		return { recorded: true };
	});

function targetLabel(target: string): string {
	switch (target) {
		case "classification":
			return "AI 分类";
		case "suggestion":
			return "AI 建议";
		case "agent_action":
			return "Agent 操作";
		default:
			return "AI 判断";
	}
}
