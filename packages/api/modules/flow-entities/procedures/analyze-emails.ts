import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import {
	analyzeAllPendingEmails,
	analyzeIndividualEmail,
	regenerateEntityNarrative,
} from "@repo/email-processor";
import { z } from "zod";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";

const analyzeEmailsSchema = z.object({
	entityId: z.string(),
	mode: z
		.enum(["pending_only", "all", "single", "narrative"])
		.default("pending_only")
		.describe(
			"pending_only=补齐还没有 ai_note 的邮件; all=强制全部重跑; single=只跑指定 thread; narrative=只刷新整体叙事",
		),
	threadId: z
		.string()
		.optional()
		.describe("mode=single 时必填"),
	alsoRefreshNarrative: z
		.boolean()
		.default(false)
		.describe("逐封跑完之后顺便刷一次整体 ai_summary"),
});

export const analyzeEmails = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/{entityId}/analyze-emails",
		tags: ["FlowEntities"],
		summary:
			"逐封邮件 AI 提炼（写入 timeline event=email_ai_note），可选刷新整体叙事",
	})
	.input(analyzeEmailsSchema)
	.handler(async ({ input, context }) => {
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			select: { id: true, organizationId: true },
		});
		if (!entity) {
			throw new ORPCError("NOT_FOUND", { message: "Entity not found" });
		}

		await requireOrgMembershipForResource(entity.organizationId, context.user.id);

		let result: {
			mode: string;
			analyzed?: number;
			total?: number;
			skipped?: number;
			failures?: number;
			created?: boolean;
			narrativeRefreshed?: boolean;
			noteCount?: number;
		} = { mode: input.mode };

		if (input.mode === "narrative") {
			const r = await regenerateEntityNarrative(input.entityId);
			result = {
				mode: input.mode,
				narrativeRefreshed: r.updated,
				noteCount: r.noteCount,
			};
			return result;
		}

		if (input.mode === "single") {
			if (!input.threadId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "single 模式必须传 threadId",
				});
			}
			const r = await analyzeIndividualEmail({
				entityId: input.entityId,
				threadId: input.threadId,
				force: true,
			});
			result = { mode: input.mode, created: r.created };
		} else {
			// pending_only / all
			if (input.mode === "all") {
				// 删除已有 ai_note，让它全部重跑
				await db.timelineEvent.deleteMany({
					where: { entityId: input.entityId, type: "email_ai_note" },
				});
			}
			const r = await analyzeAllPendingEmails(input.entityId);
			result = {
				mode: input.mode,
				analyzed: r.analyzed,
				total: r.total,
				skipped: r.skipped,
				failures: r.failures,
			};
		}

		if (input.alsoRefreshNarrative) {
			try {
				const r = await regenerateEntityNarrative(input.entityId);
				result.narrativeRefreshed = r.updated;
				result.noteCount = r.noteCount;
			} catch (err) {
				console.warn(
					`[analyzeEmails] narrative refresh failed entity=${input.entityId}:`,
					err instanceof Error ? err.message : String(err),
				);
			}
		}

		return result;
	});
