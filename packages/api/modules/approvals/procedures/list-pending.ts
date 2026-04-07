import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { listPendingApprovalsSchema } from "../types";

export const listPendingApprovals = protectedProcedure
	.route({
		method: "GET",
		path: "/approvals/pending",
		tags: ["Approvals"],
		summary: "List pending approval requests",
	})
	.input(listPendingApprovalsSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);
		const where: Record<string, unknown> = {
			organizationId: input.organizationId,
			type: "APPROVAL",
			status: "pending",
		};

		if (input.assigneeEmail) {
			where.assignee = { email: input.assigneeEmail };
		}

		const approvals = await db.flowEntity.findMany({
			where,
			include: {
				assignee: {
					select: { id: true, name: true, email: true, image: true },
				},
				_count: { select: { threads: true } },
			},
			orderBy: { createdAt: "desc" },
		});

		return approvals;
	});
