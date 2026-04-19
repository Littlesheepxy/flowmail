import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { requireOrgMembershipForResource } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { getEntitySchema } from "../types";

export const getEntity = protectedProcedure
	.route({
		method: "GET",
		path: "/flow-entities/{entityId}",
		tags: ["FlowEntities"],
		summary: "Get entity details with timeline",
	})
	.input(getEntitySchema)
	.handler(async ({ input, context }) => {
		const [entity, threads] = await Promise.all([
			db.flowEntity.findUnique({
				where: { id: input.entityId },
				include: {
					assignee: { select: { id: true, name: true, email: true, image: true } },
					category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
					timeline: {
						orderBy: { createdAt: "desc" },
						include: {
							actor: { select: { id: true, name: true, image: true } },
						},
					},
					tags: {
						include: {
							tag: { select: { id: true, name: true, color: true, source: true } },
						},
					},
				},
			}),
			// Query threads separately to avoid Prisma nullable FK issues with connectionId
			db.emailThread.findMany({
				where: { entityId: input.entityId },
				orderBy: { receivedAt: "desc" },
				select: {
					id: true,
					connectionId: true,
					messageId: true,
					subject: true,
					sender: true,
					senderName: true,
					toRecipients: true,
					ccRecipients: true,
					snippet: true,
					bodyHtml: true,
					bodyText: true,
					receivedAt: true,
					attachments: {
						select: {
							id: true,
							filename: true,
							mimeType: true,
							size: true,
							externalId: true,
							contentId: true,
							storageKey: true,
						},
					},
				},
			}),
		]);

		if (!entity) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(entity.organizationId, context.user.id);

		// Cap per-thread body size to keep first-paint payload small.
		// Forwarded marketing emails frequently embed inline base64 images that
		// blow up bodyHtml to several MB and slow the detail view dramatically.
		// Clients can fetch full bodies on demand via emailThreads.getBody.
		const BODY_SOFT_LIMIT = 80_000; // ~80KB per body field
		const trimmedThreads = threads.map((t) => {
			const htmlLen = t.bodyHtml?.length ?? 0;
			const textLen = t.bodyText?.length ?? 0;
			const htmlTruncated = htmlLen > BODY_SOFT_LIMIT;
			const textTruncated = textLen > BODY_SOFT_LIMIT;
			return {
				...t,
				bodyHtml: htmlTruncated && t.bodyHtml ? t.bodyHtml.slice(0, BODY_SOFT_LIMIT) : t.bodyHtml,
				bodyText: textTruncated && t.bodyText ? t.bodyText.slice(0, BODY_SOFT_LIMIT) : t.bodyText,
				bodyHtmlTruncated: htmlTruncated,
				bodyTextTruncated: textTruncated,
				bodyHtmlLength: htmlLen,
				bodyTextLength: textLen,
			};
		});

		return { ...entity, threads: trimmedThreads };
	});
