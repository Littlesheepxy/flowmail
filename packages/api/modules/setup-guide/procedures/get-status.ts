import { db } from "@repo/database";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import type { SetupGuideMetadata, SetupGuideStatus } from "../types";
import { setupGuideStatusSchema } from "../types";

export const getSetupGuideStatus = protectedProcedure
	.route({
		method: "GET",
		path: "/setup-guide/status",
		tags: ["SetupGuide"],
		summary: "Get setup guide status for an organization",
	})
	.input(setupGuideStatusSchema)
	.handler(async ({ input, context }): Promise<SetupGuideStatus> => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const [org, connectionCount, categoryCount, entityCount] =
			await Promise.all([
				db.organization.findUnique({
					where: { id: input.organizationId },
					select: { metadata: true },
				}),
				db.emailConnection.count({
					where: { organizationId: input.organizationId },
				}),
				db.category.count({
					where: {
						organizationId: input.organizationId,
						isDefault: false,
					},
				}),
				db.flowEntity.count({
					where: { organizationId: input.organizationId },
				}),
			]);

		const metadata: SetupGuideMetadata = org?.metadata
			? (() => {
					try {
						const parsed = JSON.parse(org.metadata as string);
						return parsed?.setupGuide ?? {};
					} catch {
						return {};
					}
				})()
			: {};

		const steps = {
			connectEmail: connectionCount > 0,
			configureCategories: categoryCount > 0,
			processFirstEmail: entityCount > 0,
			checkNotifications: metadata.notificationChecked === true,
		};

		const completedCount = Object.values(steps).filter(Boolean).length;

		return {
			tourCompleted: metadata.tourCompleted === true,
			dismissed: metadata.dismissed === true,
			steps,
			completedCount,
			totalSteps: 4,
		};
	});
