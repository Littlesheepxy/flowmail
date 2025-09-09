import { ORPCError, streamToEventIterator } from "@orpc/client";
import { type } from "@orpc/server";
import {
	convertToModelMessages,
	streamText,
	textModel,
	type UIMessage,
} from "@repo/ai";
import { getAiChatById, updateAiChat } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyOrganizationMembership } from "../../organizations/lib/membership";

export const addMessageToChat = protectedProcedure
	.route({
		method: "POST",
		path: "/ai/chats/{chatId}/messages",
		tags: ["AI"],
		summary: "Add message to chat",
		description:
			"Send all messages of the chat to the AI model to get a response",
	})
	.input(type<{ chatId: string; messages: UIMessage[] }>())
	.handler(async ({ input, context }) => {
		const { chatId, messages } = input;
		const user = context.user;

		const chat = await getAiChatById(chatId);

		if (!chat) {
			throw new ORPCError("NOT_FOUND");
		}

		if (chat.organizationId) {
			const membership = await verifyOrganizationMembership(
				chat.organizationId,
				user.id,
			);

			if (!membership) {
				throw new ORPCError("FORBIDDEN");
			}
		} else if (chat.userId !== context.user.id) {
			throw new ORPCError("FORBIDDEN");
		}

		const response = streamText({
			model: textModel,
			messages: convertToModelMessages(messages),
			async onFinish({ text }) {
				await updateAiChat({
					id: chatId,
					messages: [
						...messages,
						{
							role: "assistant",
							parts: [{ type: "text", text }],
						},
					],
				});
			},
		});

		return streamToEventIterator(response.toUIMessageStream());
	});
