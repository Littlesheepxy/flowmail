"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { toastError } from "@repo/ui/components/toast";
import { orpcClient } from "@shared/lib/orpc-client";
import {
	ArrowUpIcon,
	CodeIcon,
	EllipsisIcon,
	LightbulbIcon,
	MailIcon,
	TrendingUpIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PROMPT_SUGGESTIONS = [
	{
		icon: CodeIcon,
		text: "Help me debug a React component",
		prompt: "Help me debug a React component",
	},
	{
		icon: MailIcon,
		text: "Write a professional email",
		prompt: "Write a professional email",
	},
	{
		icon: LightbulbIcon,
		text: "Explain how to optimize database queries",
		prompt: "Explain how to optimize database queries",
	},
	{
		icon: TrendingUpIcon,
		text: "Summarize the latest AI trends",
		prompt: "Summarize the latest AI trends",
	},
] as const;

export function AiChat() {
	const [input, setInput] = useState("");
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	const { messages, status, sendMessage } = useChat({
		id: "local-chat",
		transport: {
			async sendMessages(options) {
				return eventIteratorToStream(
					await orpcClient.ai.stream(
						{
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

	const handleSubmit = async (
		e:
			| React.FormEvent<HTMLFormElement>
			| React.KeyboardEvent<HTMLTextAreaElement>,
	) => {
		e.preventDefault();

		const text = input.trim();
		if (!text) {
			return;
		}
		setInput("");

		try {
			await sendMessage({
				text,
			});
		} catch {
			toastError("Failed to send message");
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
		<div className="flex h-[calc(100vh-10rem)] flex-col max-w-3xl mx-auto">
			<div
				ref={messagesContainerRef}
				className="flex flex-1 flex-col gap-4 overflow-y-auto py-8"
			>
				{messages.length === 0 && (
					<div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 w-full">
							{PROMPT_SUGGESTIONS.map((suggestion, index) => {
								const Icon = suggestion.icon;
								return (
									<Button
										key={index}
										type="button"
										variant="secondary"
										onClick={async () => {
											try {
												await sendMessage({
													text: suggestion.prompt,
												});
											} catch {
												toastError(
													"Failed to send message",
												);
											}
										}}
										disabled={status === "streaming"}
										className="group h-auto gap-2 rounded-xl p-4 text-center"
									>
										<Icon className="size-6 text-primary" />
										<span className="text-sm text-foreground">
											{suggestion.text}
										</span>
									</Button>
								);
							})}
						</div>
					</div>
				)}

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
									: "bg-muted",
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
				className="relative shrink-0 rounded-2xl bg-card text-lg focus-within:outline-none focus-within:ring focus-within:ring-primary"
			>
				<Textarea
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Chat with your AI..."
					className="min-h-8 border bg-card rounded-2xl focus:outline-hidden focus-visible:ring-0 shadow-none p-6 pr-14"
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
					variant="primary"
					className="absolute right-3 bottom-3"
					disabled={!input.trim() || status === "streaming"}
				>
					<ArrowUpIcon className="size-4" />
				</Button>
			</form>
		</div>
	);
}
