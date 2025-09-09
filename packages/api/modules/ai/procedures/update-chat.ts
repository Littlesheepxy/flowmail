import { ORPCError } from "@orpc/client";
import { getAiChatById, updateAiChat } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyOrganizationMembership } from "../../organizations/lib/membership";

export const updateChat = protectedProcedure
	.route({
		method: "PUT",
		path: "/ai/chats/{id}",
		tags: ["AI"],
		summary: "Update chat",
		description: "Update a chat by id",
	})
	.input(
		z.object({
			id: z.string(),
			title: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { id, title } = input;
		const user = context.user;

		const chat = await getAiChatById(id);

		if (!chat) {
			throw new ORPCError("NOT_FOUND");
		}

		if (chat.organizationId) {
			await verifyOrganizationMembership(chat.organizationId, user.id);
		} else if (chat.userId !== context.user.id) {
			throw new ORPCError("FORBIDDEN");
		}

		const updatedChat = await updateAiChat({
			id,
			title,
		});

		return { chat: updatedChat };
	});
