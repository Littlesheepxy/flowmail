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
		const entity = await db.flowEntity.findUnique({
			where: { id: input.entityId },
			include: {
				assignee: { select: { id: true, name: true, email: true, image: true } },
				category: { select: { id: true, name: true, slug: true, icon: true, color: true } },
				threads: {
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
							},
						},
					},
				},
				timeline: {
					orderBy: { createdAt: "asc" },
					include: {
						actor: { select: { id: true, name: true, image: true } },
					},
				},
			},
		});

		if (!entity) {
			throw new ORPCError("NOT_FOUND");
		}

		await requireOrgMembershipForResource(entity.organizationId, context.user.id);

		return entity;
	});
