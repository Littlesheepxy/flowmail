import { eq } from "drizzle-orm";
import { db } from "../client";
import { aiChat } from "../schema/postgres";

export async function getAiChatsByUserId({
	limit,
	offset,
	userId,
}: {
	limit: number;
	offset: number;
	userId: string;
}) {
	return await db.query.aiChat.findMany({
		where: (aiChat, { eq }) => eq(aiChat.userId, userId),
		limit,
		offset,
	});
}

export async function getAiChatsByOrganizationId({
	limit,
	offset,
	organizationId,
}: {
	limit: number;
	offset: number;
	organizationId: string;
}) {
	return await db.query.aiChat.findMany({
		where: (aiChat, { eq }) => eq(aiChat.organizationId, organizationId),
		limit,
		offset,
	});
}

export async function getAiChatById(id: string) {
	return db.query.aiChat.findFirst({
		where: (aiChat, { eq }) => eq(aiChat.id, id),
	});
}

export async function createAiChat({
	organizationId,
	userId,
	title,
}: {
	organizationId?: string;
	userId: string;
	title?: string;
}) {
	const [{ id }] = await db
		.insert(aiChat)
		.values({
			organizationId,
			userId,
			title,
		})
		.returning({ id: aiChat.id });

	const createdChat = await getAiChatById(id);

	if (!createdChat) {
		throw new Error("Failed to create chat");
	}

	return createdChat;
}

export async function updateAiChat({
	id,
	title,
	messages,
}: {
	id: string;
	title?: string;
	messages?: (typeof aiChat.$inferInsert)["messages"];
}) {
	return await db
		.update(aiChat)
		.set({ title, messages })
		.where(eq(aiChat.id, id))
		.returning();
}

export async function deleteAiChat(id: string) {
	return await db.delete(aiChat).where(eq(aiChat.id, id));
}
