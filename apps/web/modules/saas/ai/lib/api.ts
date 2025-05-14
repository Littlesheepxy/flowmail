import { apiClient } from "@shared/lib/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";

export const aiChatListQueryKey = (organizationId?: string) =>
	organizationId
		? (["ai-chat-list", organizationId] as const)
		: (["ai-chat-list"] as const);
export const useAiChatListQuery = (organizationId?: string) =>
	useQuery({
		queryKey: aiChatListQueryKey(organizationId),
		queryFn: async () => {
			const response = await apiClient.ai.chats.$get({
				query: {
					organizationId,
				},
			});

			if (!response.ok) {
				throw new Error("Failed to fetch AI chat list");
			}

			return response.json().then((data) => data.chats);
		},
	});

export const aiChatQueryKey = (id: string) => ["ai-chat", id];
export const useAiChatQuery = (id: string) =>
	useQuery({
		queryKey: aiChatQueryKey(id),
		queryFn: async () => {
			if (id === "new") {
				return null;
			}

			const response = await apiClient.ai.chats[":id"].$get({
				param: {
					id,
				},
			});

			if (!response.ok) {
				throw new Error("Failed to fetch AI chat");
			}

			return response.json().then((res) => res.chat);
		},
	});

export const useCreateAiChatMutation = () => {
	return useMutation({
		mutationFn: async ({
			title,
			organizationId,
		}: {
			title?: string;
			organizationId?: string;
		}) => {
			const response = await apiClient.ai.chats.$post({
				json: {
					title,
					organizationId,
				},
			});

			if (!response.ok) {
				throw new Error("Failed to create AI chat");
			}

			return response.json().then((res) => res.chat);
		},
	});
};

export const updateAiChatMutation = () => {
	return useMutation({
		mutationFn: async ({ id, title }: { id: string; title?: string }) => {
			const response = await apiClient.ai.chats[":id"].$put({
				param: { id },
				json: { title },
			});

			if (!response.ok) {
				throw new Error("Failed to update AI chat");
			}

			return response.json().then((res) => res.chat);
		},
	});
};

export const deleteAiChatMutation = () => {
	return useMutation({
		mutationFn: async (id: string) => {
			const response = await apiClient.ai.chats[":id"].$delete({
				param: { id },
			});

			if (!response.ok) {
				throw new Error("Failed to delete AI chat");
			}
		},
	});
};
