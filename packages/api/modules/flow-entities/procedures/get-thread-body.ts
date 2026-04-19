import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { z } from "zod";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";

// 单封邮件 body 按需拉取
// ThreadChatView 首屏不带 bodyHtml/bodyText（含 base64 图片可达 1.7MB/封），
// 每封邮件展开时单独调用此接口取原文。
export const getThreadBodySchema = z.object({
	threadId: z.string(),
});

export const getThreadBody = protectedProcedure
	.route({
		method: "GET",
		path: "/email-threads/{threadId}/body",
		tags: ["FlowEntities"],
		summary: "Get full body of a single email thread on demand",
	})
	.input(getThreadBodySchema)
	.handler(async ({ input, context }) => {
		const thread = await db.emailThread.findUnique({
			where: { id: input.threadId },
			select: {
				id: true,
				bodyHtml: true,
				bodyText: true,
				entity: { select: { organizationId: true } },
			},
		});

		if (!thread) {
			throw new ORPCError("NOT_FOUND");
		}
		if (!thread.entity) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(
			thread.entity.organizationId,
			context.user.id,
		);

		// 单封 body cap 200KB（含 base64 图片的邮件最大见过 450KB），
		// 超过部分 truncate，前端可显示「下载原文」选项。
		const HARD_LIMIT = 200_000;
		const htmlLen = thread.bodyHtml?.length ?? 0;
		const textLen = thread.bodyText?.length ?? 0;
		const htmlTruncated = htmlLen > HARD_LIMIT;
		const textTruncated = textLen > HARD_LIMIT;

		return {
			threadId: thread.id,
			bodyHtml:
				htmlTruncated && thread.bodyHtml
					? thread.bodyHtml.slice(0, HARD_LIMIT)
					: thread.bodyHtml,
			bodyText:
				textTruncated && thread.bodyText
					? thread.bodyText.slice(0, HARD_LIMIT)
					: thread.bodyText,
			bodyHtmlTruncated: htmlTruncated,
			bodyTextTruncated: textTruncated,
			bodyHtmlLength: htmlLen,
			bodyTextLength: textLen,
		};
	});
