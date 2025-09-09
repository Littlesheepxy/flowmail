import { db } from "../client";

export async function getAiChatsByUserId({
	limit,
	offset,
	userId,
}: {
	limit: number;
	offset: number;
	userId: string;
}) {
	return await db.aiChat.findMany({
		where: {
			userId,
		},
		take: limit,
		skip: offset,
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
	return await db.aiChat.findMany({
		where: {
			organizationId,
		},
		take: limit,
		skip: offset,
	});
}

export async function getAiChatById(id: string) {
	return await db.aiChat.findUnique({
		where: {
			id,
		},
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
	return await db.aiChat.create({
		data: {
			organizationId,
			userId,
			title,
		},
	});
}

export async function updateAiChat({
	id,
	title,
	messages,
}: {
	id: string;
	title?: string;
	messages?: Array<object>;
}) {
	return await db.aiChat.update({
		where: {
			id,
		},
		data: {
			title,
			messages,
		},
	});
}

export async function deleteAiChat(id: string) {
	return await db.aiChat.delete({
		where: {
			id,
		},
	});
}
