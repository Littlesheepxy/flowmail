"use client";

import { type UIMessage, useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { SidebarContentLayout } from "@saas/shared/components/SidebarContentLayout";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import {
	skipToken,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Textarea } from "@ui/components/textarea";
import { cn } from "@ui/lib";
import { EllipsisIcon, PlusIcon, SendIcon } from "lucide-react";
import { useFormatter } from "next-intl";
import { useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export function AiChat({ organizationId }: { organizationId?: string }) {
	const formatter = useFormatter();
	const queryClient = useQueryClient();
	const [input, setInput] = useState("");
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const { data, status: chatsStatus } = useQuery(
		orpc.ai.chats.list.queryOptions({
			input: {
				organizationId,
			},
		}),
	);
	const [chatId, setChatId] = useQueryState("chatId");
	const currentChatQuery = useQuery(
		orpc.ai.chats.find.queryOptions({
			input: chatId
				? {
						id: chatId,
					}
				: skipToken,
		}),
	);

	const createChatMutation = useMutation(
		orpc.ai.chats.create.mutationOptions(),
	);

	const chats = data?.chats ?? [];
	const currentChat = currentChatQuery.data?.chat ?? null;

	const { messages, setMessages, status, sendMessage } = useChat({
		id: chatId ?? "new",
		transport: {
			async sendMessages(options) {
				if (!chatId) {
					throw new Error("Chat ID is required");
				}

				return eventIteratorToStream(
					await orpcClient.ai.chats.messages.add(
						{
							chatId,
							messages: options.messages,
						},
						{ signal: options.abortSignal },
					),
				);
			},
			reconnectToStream() {
				throw new Error("Unsupported");
			},
		},
	});

	useEffect(() => {
		if (messages.length && currentChat?.messages) {
			queryClient.setQueryData(
				orpc.ai.chats.find.queryKey({
					input: { id: chatId ?? "new" },
				}),
				(oldData) => {
					if (!oldData) {
						return undefined;
					}
					return {
						chat: {
							...oldData.chat,
							messages: messages,
						},
					};
				},
			);
		}
	}, [messages]);

	useEffect(() => {
		if (currentChat?.messages) {
			setMessages(currentChat.messages as unknown as UIMessage[]);
		}
	}, [currentChat?.messages]);

	const createNewChat = useCallback(async () => {
		const newChat = await createChatMutation.mutateAsync({
			organizationId,
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.ai.chats.list.queryKey({
				input: {
					organizationId,
				},
			}),
		});

		setChatId(newChat.chat.id);
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

	const handleSubmit = async (
		e:
			| React.FormEvent<HTMLFormElement>
			| React.KeyboardEvent<HTMLTextAreaElement>,
	) => {
		const text = input.trim();
		setInput("");
		e.preventDefault();

		try {
			await sendMessage({
				text,
			});
		} catch {
			toast.error("Failed to send message");
			setInput(text);
		}
	};

	useEffect(() => {
		if (messagesContainerRef.current) {
			messagesContainerRef.current.scrollTop =
				messagesContainerRef.current.scrollHeight;
		}
	}, [messages.length, status]);

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
				<div
					ref={messagesContainerRef}
					className="flex flex-1 flex-col gap-2 overflow-y-auto py-8"
				>
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
								{message.parts?.map((part, index) =>
									part.type === "text" ? (
										<span key={index}>{part.text}</span>
									) : null,
								)}
							</div>
						</div>
					))}

					{(status === "streaming" || status === "submitted") && (
						<div className="flex justify-start">
							<div className="flex max-w-2xl items-center gap-2 rounded-lg bg-secondary/10 px-4 py-2 text-foreground">
								<EllipsisIcon className="size-6 animate-pulse" />
							</div>
						</div>
					)}
				</div>

				<form
					onSubmit={handleSubmit}
					className="relative shrink-0 rounded-lg border bg-card text-lg shadow-sm focus-within:outline-none focus-within:ring focus-within:ring-primary"
				>
					<Textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						disabled={!hasChat}
						placeholder="Chat with your AI..."
						className="min-h-8 rounded-none border-none bg-transparent focus:outline-hidden focus-visible:ring-0 shadow-none p-6 pr-14"
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
