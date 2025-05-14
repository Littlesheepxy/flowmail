import { streamText, textModel } from "@repo/ai";
import {
	AiChatSchema,
	createAiChat,
	deleteAiChat,
	getAiChatById,
	getAiChatsByOrganizationId,
	getAiChatsByUserId,
	updateAiChat,
} from "@repo/database";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { verifyOrganizationMembership } from "./organizations/lib/membership";

const MessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string(),
});

const ChatSchema = AiChatSchema.extend({
	messages: z.array(MessageSchema),
});

export const aiRouter = new Hono()
	.basePath("/ai")
	.use(authMiddleware)
	.get(
		"/chats",
		describeRoute({
			tags: ["AI"],
			summary: "Get chats",
			description: "Get all chats for current user or organization",
			responses: {
				200: {
					description: "Chats",
					content: {
						"application/json": {
							schema: resolver(
								z.object({ chats: z.array(ChatSchema) }),
							),
						},
					},
				},
			},
		}),
		validator(
			"query",
			z.object({ organizationId: z.string().optional() }).optional(),
		),
		async (c) => {
			const query = c.req.valid("query");
			const chats = await (query?.organizationId
				? getAiChatsByOrganizationId({
						limit: 10,
						offset: 0,
						organizationId: query?.organizationId,
					})
				: getAiChatsByUserId({
						limit: 10,
						offset: 0,
						userId: c.get("user").id,
					}));

			return c.json({ chats });
		},
	)
	.get(
		"/chats/:id",
		describeRoute({
			tags: ["AI"],
			summary: "Get chat",
			description: "Get a chat by id",
			responses: {
				200: {
					description: "Chat",
					content: {
						"application/json": {
							schema: resolver(z.object({ chat: ChatSchema })),
						},
					},
				},
			},
		}),
		async (c) => {
			const { id } = c.req.param();

			const chat = await getAiChatById(id);

			if (!chat) {
				throw new HTTPException(404, { message: "Chat not found" });
			}

			if (chat.organizationId) {
				await verifyOrganizationMembership(
					chat.organizationId,
					c.get("user").id,
				);
			} else if (chat.userId !== c.get("user").id) {
				throw new HTTPException(403, { message: "Forbidden" });
			}

			return c.json({ chat });
		},
	)
	.post(
		"/chats",
		describeRoute({
			tags: ["AI"],
			summary: "Create chat",
			description: "Create a new chat",
			responses: {
				200: {
					description: "Chat",
					content: {
						"application/json": {
							schema: resolver(z.object({ chat: ChatSchema })),
						},
					},
				},
			},
		}),
		validator(
			"json",
			z.object({
				title: z.string().optional(),
				organizationId: z.string().optional(),
			}),
		),
		async (c) => {
			const { title, organizationId } = c.req.valid("json");
			const user = c.get("user");

			if (organizationId) {
				await verifyOrganizationMembership(organizationId, user.id);
			}

			const chat = await createAiChat({
				title: title,
				organizationId,
				userId: user.id,
			});

			if (!chat) {
				throw new HTTPException(500, {
					message: "Failed to create chat",
				});
			}

			return c.json({ chat });
		},
	)
	.put(
		"/chats/:id",
		describeRoute({
			tags: ["AI"],
			summary: "Update chat",
			description: "Update a chat by id",
			responses: {
				200: {
					description: "Chat",
					content: {
						"application/json": {
							schema: resolver(z.object({ chat: ChatSchema })),
						},
					},
				},
			},
		}),
		validator("json", z.object({ title: z.string().optional() })),
		async (c) => {
			const { id } = c.req.param();
			const { title } = c.req.valid("json");
			const user = c.get("user");

			const chat = await getAiChatById(id);

			if (!chat) {
				throw new HTTPException(404, { message: "Chat not found" });
			}

			if (chat.organizationId) {
				await verifyOrganizationMembership(
					chat.organizationId,
					user.id,
				);
			} else if (chat.userId !== c.get("user").id) {
				throw new HTTPException(403, { message: "Forbidden" });
			}

			const updatedChat = await updateAiChat({
				id,
				title,
			});

			return c.json({ chat: updatedChat });
		},
	)
	.delete(
		"/chats/:id",
		describeRoute({
			tags: ["AI"],
			summary: "Delete chat",
			description: "Delete a chat by id",
			responses: {
				204: {
					description: "Chat deleted",
				},
			},
		}),
		async (c) => {
			const { id } = c.req.param();
			const user = c.get("user");
			const chat = await getAiChatById(id);

			if (!chat) {
				throw new HTTPException(404, { message: "Chat not found" });
			}

			if (chat.organizationId) {
				await verifyOrganizationMembership(
					chat.organizationId,
					user.id,
				);
			} else if (chat.userId !== c.get("user").id) {
				throw new HTTPException(403, { message: "Forbidden" });
			}

			await deleteAiChat(id);

			return c.body(null, 204);
		},
	)
	.post(
		"/chats/:id/messages",
		describeRoute({
			tags: ["AI"],
			summary: "Add message to chat",
			description:
				"Send all messages of the chat to the AI model to get a response",
			responses: {
				200: {
					description:
						"Returns a stream of the response from the AI model",
				},
			},
		}),
		validator(
			"json",
			z.object({
				messages: z.array(
					z.object({
						role: z.enum(["user", "assistant"]),
						content: z.string(),
					}),
				),
			}),
		),
		async (c) => {
			const { id } = c.req.param();
			const { messages } = c.req.valid("json");
			const user = c.get("user");

			const chat = await getAiChatById(id);

			if (!chat) {
				throw new HTTPException(404, { message: "Chat not found" });
			}

			if (chat.organizationId) {
				await verifyOrganizationMembership(
					chat.organizationId,
					user.id,
				);
			} else if (chat.userId !== c.get("user").id) {
				throw new HTTPException(403, { message: "Forbidden" });
			}

			const response = streamText({
				model: textModel,
				messages,
				async onFinish({ text }) {
					await updateAiChat({
						id,
						messages: [
							...messages,
							{
								role: "assistant",
								content: text,
							},
						],
					});
				},
			});

			return response.toDataStreamResponse({
				sendUsage: true,
			});
		},
	);
