import { AiChatSchema } from "@repo/database";
import { z } from "zod";

export const MessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string(),
});

export const ChatSchema = AiChatSchema.extend({
	messages: z.array(MessageSchema),
});
