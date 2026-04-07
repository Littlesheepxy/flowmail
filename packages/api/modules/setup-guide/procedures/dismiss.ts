import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import type { SetupGuideMetadata } from "../types";
import { dismissGuideSchema } from "../types";

export const dismissSetupGuide = protectedProcedure
	.route({
		method: "POST",
		path: "/setup-guide/dismiss",
		tags: ["SetupGuide"],
		summary: "Dismiss the setup guide permanently",
	})
	.input(dismissGuideSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const org = await db.organization.findUnique({
			where: { id: input.organizationId },
			select: { metadata: true },
		});

		let existingMetadata: Record<string, unknown> = {};
		if (org?.metadata) {
			try {
				existingMetadata = JSON.parse(org.metadata as string);
			} catch {
				existingMetadata = {};
			}
		}

		const setupGuide: SetupGuideMetadata =
			(existingMetadata.setupGuide as SetupGuideMetadata) ?? {};
		setupGuide.dismissed = true;

		await db.organization.update({
			where: { id: input.organizationId },
			data: {
				metadata: JSON.stringify({
					...existingMetadata,
					setupGuide,
				}),
			},
		});

		return { success: true };
	});
