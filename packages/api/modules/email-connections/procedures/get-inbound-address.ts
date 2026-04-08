import { z } from "zod";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";
import { getOrCreateInboundAddress } from "../lib/inbound-address";

export const getInboundAddress = protectedProcedure
	.route({
		method: "GET",
		path: "/email-connections/inbound-address",
		tags: ["EmailConnections"],
		summary: "Get the inbound email address for an organization",
	})
	.input(
		z.object({
			organizationId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const { address, shortId } = await getOrCreateInboundAddress(
			input.organizationId,
		);

		return { address, shortId };
	});
