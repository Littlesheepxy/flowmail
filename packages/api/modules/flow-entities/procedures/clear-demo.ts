import { db } from "@repo/database";
import { z } from "zod";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";

const DEMO_MARKER = "_isDemo";
const DEMO_CONNECTION_EMAIL = "demo@flowmail.work";

export const clearDemo = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/clear-demo",
		tags: ["FlowEntities"],
		summary: "Clear all demo data for an organization",
	})
	.input(z.object({ organizationId: z.string() }))
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const demoEntities = await db.flowEntity.findMany({
			where: {
				organizationId: input.organizationId,
				extractedFields: { contains: DEMO_MARKER },
			},
			select: { id: true },
		});

		if (demoEntities.length === 0) {
			return { deleted: 0 };
		}

		const ids = demoEntities.map((e) => e.id);

		await db.timelineEvent.deleteMany({
			where: { entityId: { in: ids } },
		});

		await db.emailThread.deleteMany({
			where: { entityId: { in: ids } },
		});

		const result = await db.flowEntity.deleteMany({
			where: { id: { in: ids } },
		});

		await db.emailConnection.deleteMany({
			where: {
				organizationId: input.organizationId,
				email: DEMO_CONNECTION_EMAIL,
			},
		});

		return { deleted: result.count };
	});
