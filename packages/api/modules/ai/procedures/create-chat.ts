import { ORPCError } from "@orpc/client";
import { createAiChat } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyOrganizationMembership } from "../../organizations/lib/membership";

export const createChat = protectedProcedure
	.route({
		method: "POST",
		path: "/ai/chats",
		tags: ["AI"],
		summary: "Create chat",
		description: "Create a new chat",
	})
	.input(
		z.object({
			title: z.string().optional(),
			organizationId: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { title, organizationId } = input;
		const user = context.user;

		if (organizationId) {
			const membership = await verifyOrganizationMembership(
				organizationId,
				user.id,
			);

			if (!membership) {
				throw new ORPCError("FORBIDDEN");
			}
		}

		const chat = await createAiChat({
			title: title,
			organizationId,
			userId: user.id,
		});

		if (!chat) {
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}

		return { chat };
	});
