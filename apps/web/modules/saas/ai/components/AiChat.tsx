"use client";

import {
	aiChatListQueryKey,
	useAiChatListQuery,
	useAiChatQuery,
	useCreateAiChatMutation,
} from "@saas/ai/lib/api";
import { SidebarContentLayout } from "@saas/shared/components/SidebarContentLayout";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Textarea } from "@ui/components/textarea";
import { cn } from "@ui/lib";
import { type Message, useChat } from "ai/react";
import { EllipsisIcon, PlusIcon, SendIcon } from "lucide-react";
import { useFormatter } from "next-intl";
import { useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo } from "react";

export function AiChat({ organizationId }: { organizationId?: string }) {
	const formatter = useFormatter();
	const queryClient = useQueryClient();
	const { data: chats, status: chatsStatus } =
		useAiChatListQuery(organizationId);
	const [chatId, setChatId] = useQueryState("chatId");
	const { data: currentChat } = useAiChatQuery(chatId ?? "new");
	const createChatMutation = useCreateAiChatMutation();
	const {
		messages,
		input,
		handleInputChange,
		handleSubmit,
		isLoading,
		setMessages,
	} = useChat({
		api: `/api/ai/chats/${chatId}/messages`,
		credentials: "include",
		initialMessages: [],
	});

	useEffect(() => {
		if (currentChat?.messages?.length) {
			setMessages(currentChat.messages as unknown as Message[]);
		}
	}, [currentChat]);

	const createNewChat = useCallback(async () => {
		const newChat = await createChatMutation.mutateAsync({
			organizationId,
		});
		await queryClient.invalidateQueries({
			queryKey: aiChatListQueryKey(organizationId),
		});
		setChatId(newChat.id);
	}, [createChatMutation]);

	useEffect(() => {
		(async () => {
			if (chatId || chatsStatus !== "success") {
				return;
			}

			if (chats?.length) {
				setChatId(chats[0].id);
			} else {
				await createNewChat();
				setMessages([]);
			}
		})();
	}, [chatsStatus]);

	const hasChat =
		chatsStatus === "success" && !!chats?.length && !!currentChat?.id;

	const sortedChats = useMemo(() => {
		return (
			chats?.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() -
					new Date(a.createdAt).getTime(),
			) ?? []
		);
	}, [chats]);

	return (
		<SidebarContentLayout
			sidebar={
				<div>
					<Button
						variant="light"
						size="sm"
						className="mb-4 flex w-full items-center gap-2"
						loading={createChatMutation.isPending}
						onClick={createNewChat}
					>
						<PlusIcon className="size-4" />
						New chat
					</Button>

					{sortedChats.map((chat) => (
						<div className="relative" key={chat.id}>
							<Button
								variant="link"
								onClick={() => setChatId(chat.id)}
								className={cn(
									"block h-auto w-full py-2 text-left text-foreground hover:no-underline",
									chat.id === chatId &&
										"bg-primary/10 font-bold text-primary",
								)}
							>
								<span className="w-full overflow-hidden">
									<span className="block truncate">
										{chat.title ??
											(chat.messages?.at(0) as any)
												?.content ??
											"Untitled chat"}
									</span>
									<small className="block font-normal">
										{formatter.dateTime(
											new Date(chat.createdAt),
											{
												dateStyle: "short",
												timeStyle: "short",
											},
										)}
									</small>
								</span>
							</Button>
						</div>
					))}
				</div>
			}
		>
			<div className="-mt-8 flex h-[calc(100vh-10rem)] flex-col">
				<div className="flex flex-1 flex-col gap-2 overflow-y-auto py-8">
					{messages.map((message, index) => (
						<div
							key={index}
							className={cn(
								"flex flex-col gap-2",
								message.role === "user"
									? "items-end"
									: "items-start",
							)}
						>
							<div
								className={cn(
									"flex max-w-2xl items-center gap-2 whitespace-pre-wrap rounded-lg px-4 py-2 text-foreground",
									message.role === "user"
										? "bg-primary/10"
										: "bg-secondary/10",
								)}
							>
								{message.content}
							</div>
						</div>
					))}

					{isLoading && (
						<div className="flex justify-start">
							<div className="flex max-w-2xl items-center gap-2 rounded-lg bg-secondary/10 px-4 py-2 text-foreground">
								<EllipsisIcon className="size-6 animate-pulse" />
							</div>
						</div>
					)}
				</div>

				<form
					onSubmit={handleSubmit}
					className="relative shrink-0 rounded-lg border-none bg-card py-6 pr-14 pl-6 text-lg shadow-sm focus:outline-hidden focus-visible:ring-0"
				>
					<Textarea
						value={input}
						onChange={handleInputChange}
						disabled={!hasChat}
						placeholder="Chat with your AI..."
						className="min-h-8 rounded-none border-none bg-transparent p-0 focus:outline-hidden focus-visible:ring-0 shadow-none"
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSubmit(e);
							}
						}}
					/>

					<Button
						type="submit"
						size="icon"
						variant="secondary"
						className="absolute right-3 bottom-3"
						disabled={!hasChat}
					>
						<SendIcon className="size-4" />
					</Button>
				</form>
			</div>
		</SidebarContentLayout>
	);
}
