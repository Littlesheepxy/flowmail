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

		// narrative 模式快（单次 LLM），同步返回结果。
		if (input.mode === "narrative") {
			const r = await regenerateEntityNarrative(input.entityId);
			return {
				mode: input.mode,
				started: false,
				narrativeRefreshed: r.updated,
				noteCount: r.noteCount,
			};
		}

		// pending_only / all / single：可能跑几十秒到 1-2 分钟（每封邮件一次 LLM），
		// Cloudflare 100s 会切断，nginx 504，前端 oRPC 解析报 MALFORMED_ORPC_ERROR_RESPONSE。
		// 改为 fire-and-forget：立即返回，后台跑。前端通过 entity.get 5s 轮询看到时间线增量。
		const entityId = input.entityId;
		const mode = input.mode;
		const threadId = input.threadId;
		const alsoRefreshNarrative = input.alsoRefreshNarrative;

		if (mode === "single" && !threadId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "single 模式必须传 threadId",
			});
		}

		// 启动后台任务（不 await）。错误只打日志，不影响 HTTP 响应。
		void (async () => {
			try {
				if (mode === "single") {
					await analyzeIndividualEmail({
						entityId,
						threadId: threadId as string,
						force: true,
					});
				} else {
					if (mode === "all") {
						await db.timelineEvent.deleteMany({
							where: { entityId, type: "email_ai_note" },
						});
					}
					// 后台任务：循环调用直到 done=true（每批 3 封并发跑）
					let safetyGuard = 50; // 最多 150 封邮件
					while (safetyGuard-- > 0) {
						const r = await analyzeAllPendingEmails(entityId, {
							batchSize: 3,
							concurrency: 3,
						});
						if (r.done) {
							break;
						}
					}
				}

				if (alsoRefreshNarrative) {
					try {
						await regenerateEntityNarrative(entityId);
					} catch (err) {
						console.warn(
							`[analyzeEmails] narrative refresh failed entity=${entityId}:`,
							err instanceof Error ? err.message : String(err),
						);
					}
				}
			} catch (err) {
				console.error(
					`[analyzeEmails] background task failed entity=${entityId} mode=${mode}:`,
					err instanceof Error ? err.message : String(err),
				);
			}
		})();

		return {
			mode,
			started: true,
		};
	});
