"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { ChatMessage } from "../adapters/types";

interface MessageListProps {
	messages: ChatMessage[];
	renderMessage?: (msg: ChatMessage) => ReactNode;
	isLoading: boolean;
}

export function MessageList({
	messages,
	renderMessage,
	isLoading,
}: MessageListProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isLoading]);

	return (
		<div
			style={{
				flex: 1,
				overflow: "auto",
				padding: "16px",
				display: "flex",
				flexDirection: "column",
				gap: 12,
			}}
		>
			{messages.map((msg) =>
				renderMessage ? (
					renderMessage(msg)
				) : (
					<DefaultMessage key={msg.id} message={msg} />
				),
			)}

			{isLoading && messages[messages.length - 1]?.role !== "assistant" && (
				<div
					style={{
						display: "flex",
						gap: 4,
						padding: "12px 16px",
						opacity: 0.5,
					}}
				>
					<span
						style={{
							width: 6,
							height: 6,
							borderRadius: "50%",
							background: "currentColor",
							animation: "ai-eyes-dot-bounce 1.2s ease-in-out infinite",
						}}
					/>
					<span
						style={{
							width: 6,
							height: 6,
							borderRadius: "50%",
							background: "currentColor",
							animation: "ai-eyes-dot-bounce 1.2s ease-in-out 0.2s infinite",
						}}
					/>
					<span
						style={{
							width: 6,
							height: 6,
							borderRadius: "50%",
							background: "currentColor",
							animation: "ai-eyes-dot-bounce 1.2s ease-in-out 0.4s infinite",
						}}
					/>
				</div>
			)}

			<div ref={bottomRef} />
		</div>
	);
}

function DefaultMessage({ message }: { message: ChatMessage }) {
	const isUser = message.role === "user";

	return (
		<div
			style={{
				display: "flex",
				justifyContent: isUser ? "flex-end" : "flex-start",
			}}
		>
			<div
				style={{
					maxWidth: "85%",
					padding: "10px 14px",
					borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
					background: isUser
						? "var(--ai-eyes-user-bg, #111)"
						: "var(--ai-eyes-assistant-bg, #f5f5f5)",
					color: isUser
						? "var(--ai-eyes-user-fg, #fff)"
						: "var(--ai-eyes-assistant-fg, #111)",
					fontSize: 13,
					lineHeight: 1.6,
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
				}}
			>
				{message.content}
			</div>
		</div>
	);
}
