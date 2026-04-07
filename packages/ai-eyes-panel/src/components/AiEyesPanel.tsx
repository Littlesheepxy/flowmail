"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import type {
	ChatAdapter,
	ChatMessage,
	SuggestionChip,
} from "../adapters/types";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

export interface AiEyesPanelProps {
	adapter: ChatAdapter;
	open: boolean;
	onClose: () => void;
	title?: string;
	subtitle?: string;
	renderMessage?: (msg: ChatMessage) => ReactNode;
	suggestions?: SuggestionChip[];
	prefill?: string;
	width?: number;
	height?: number;
	position?: "bottom-right" | "bottom-left" | "center";
	placeholder?: string;
	className?: string;
	style?: React.CSSProperties;
	header?: ReactNode;
	footer?: ReactNode;
}

export function AiEyesPanel({
	adapter,
	open,
	onClose,
	title = "AI Assistant",
	subtitle,
	renderMessage,
	suggestions,
	prefill,
	width = 380,
	height = 520,
	position = "bottom-right",
	placeholder,
	className,
	style,
	header,
	footer,
}: AiEyesPanelProps) {
	const [animOpen, setAnimOpen] = useState(false);

	useEffect(() => {
		if (open) {
			requestAnimationFrame(() => setAnimOpen(true));
		} else {
			setAnimOpen(false);
		}
	}, [open]);

	const handleSend = useCallback(
		(message: string) => {
			adapter.send({ message });
		},
		[adapter],
	);

	if (!open && !animOpen) {
		return null;
	}

	const positionStyle: React.CSSProperties =
		position === "center"
			? {
					position: "fixed",
					top: "50%",
					left: "50%",
					transform: animOpen
						? "translate(-50%, -50%) scale(1)"
						: "translate(-50%, -45%) scale(0.95)",
				}
			: position === "bottom-left"
				? {
						position: "fixed",
						bottom: 80,
						left: 24,
						transform: animOpen
							? "translateY(0) scale(1)"
							: "translateY(20px) scale(0.95)",
					}
				: {
						position: "fixed",
						bottom: 80,
						right: 24,
						transform: animOpen
							? "translateY(0) scale(1)"
							: "translateY(20px) scale(0.95)",
					};

	return (
		<>
			{/* Backdrop for center position */}
			{position === "center" && (
				// biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay dismiss
				<div
					role="presentation"
					style={{
						position: "fixed",
						inset: 0,
						background: "rgba(0,0,0,0.3)",
						zIndex: 9998,
						opacity: animOpen ? 1 : 0,
						transition: "opacity 0.2s",
					}}
					onClick={onClose}
					onKeyDown={() => {}}
				/>
			)}

			<div
				className={className}
				style={{
					...positionStyle,
					width,
					height,
					zIndex: 9999,
					display: "flex",
					flexDirection: "column",
					borderRadius: 16,
					overflow: "hidden",
					background: "var(--ai-eyes-panel-bg, white)",
					color: "var(--ai-eyes-panel-fg, #111)",
					border: "1px solid var(--ai-eyes-border, #e5e5e5)",
					boxShadow:
						"0 20px 60px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)",
					opacity: animOpen ? 1 : 0,
					transition:
						"opacity 0.25s, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
					pointerEvents: animOpen ? "auto" : "none",
					...style,
				}}
			>
				{/* Header */}
				{header ?? (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "14px 16px",
							borderBottom:
								"1px solid var(--ai-eyes-border, #e5e5e5)",
						}}
					>
						<div>
							<div style={{ fontWeight: 600, fontSize: 14 }}>
								{title}
							</div>
							{subtitle && (
								<div
									style={{
										fontSize: 11,
										opacity: 0.6,
										marginTop: 2,
									}}
								>
									{subtitle}
								</div>
							)}
						</div>
						<button
							type="button"
							onClick={onClose}
							style={{
								width: 28,
								height: 28,
								borderRadius: 8,
								border: "none",
								background: "transparent",
								color: "inherit",
								cursor: "pointer",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: 18,
								opacity: 0.5,
							}}
							aria-label="Close"
						>
							&times;
						</button>
					</div>
				)}

				{/* Messages */}
				<MessageList
					messages={adapter.messages}
					renderMessage={renderMessage}
					isLoading={adapter.isLoading}
				/>

				{/* Input */}
				<ChatInput
					onSend={handleSend}
					disabled={adapter.isLoading}
					placeholder={placeholder}
					suggestions={suggestions}
					prefill={prefill}
				/>

				{footer}
			</div>

			{/* Loading dots animation */}
			<style>{`
				@keyframes ai-eyes-dot-bounce {
					0%, 80%, 100% { transform: translateY(0); }
					40% { transform: translateY(-4px); }
				}
			`}</style>
		</>
	);
}
