import { ORPCError } from "@orpc/client";
import type { UIMessage } from "@repo/ai";
import { getAiChatsByOrganizationId, getAiChatsByUserId } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyOrganizationMembership } from "../../organizations/lib/membership";

export const listChats = protectedProcedure
	.route({
		method: "GET",
		path: "/ai/chats",
		tags: ["AI"],
		summary: "Get chats",
		description: "Get all chats for current user or organization",
	})
	.input(
		z
			.object({
				organizationId: z.string().optional(),
			})
			.optional(),
	)
	.handler(async ({ input, context }) => {
		if (input?.organizationId) {
			const membership = await verifyOrganizationMembership(
				input.organizationId,
				context.user.id,
			);

			if (!membership) {
				throw new ORPCError("FORBIDDEN");
			}
		}

		const chats = await (input?.organizationId
			? getAiChatsByOrganizationId({
					limit: 10,
					offset: 0,
					organizationId: input.organizationId,
				})
			: getAiChatsByUserId({
					limit: 10,
					offset: 0,
					userId: context.user.id,
				}));

		return {
			chats: chats.map((chat) => ({
				...chat,
				messages: (chat.messages ?? []) as unknown as UIMessage[],
			})),
		};
	});
