import { db } from "@repo/database";
import { z } from "zod";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";

export const checkInboundStatus = protectedProcedure
	.route({
		method: "GET",
		path: "/email-connections/inbound-status",
		tags: ["EmailConnections"],
		summary: "Check if any inbound emails have been received",
	})
	.input(
		z.object({
			organizationId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const latestInbound = await db.inboundEmail.findFirst({
			where: { organizationId: input.organizationId },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				fromEmail: true,
				subject: true,
				entityId: true,
				processedAt: true,
				createdAt: true,
				entity: {
					select: {
						id: true,
						title: true,
						type: true,
						aiSummary: true,
						status: true,
					},
				},
			},
		});

		const totalCount = await db.inboundEmail.count({
			where: { organizationId: input.organizationId },
		});

		return {
			hasReceived: totalCount > 0,
			totalCount,
			latest: latestInbound,
		};
	});
