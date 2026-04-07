"use client";

import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { SuggestionChip } from "../adapters/types";

interface ChatInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
	placeholder?: string;
	suggestions?: SuggestionChip[];
	prefill?: string;
}

export function ChatInput({
	onSend,
	disabled,
	placeholder,
	suggestions,
	prefill,
}: ChatInputProps) {
	const [input, setInput] = useState(prefill ?? "");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		if (prefill) {
			setInput(prefill);
			textareaRef.current?.focus();
		}
	}, [prefill]);

	const handleSend = useCallback(() => {
		const trimmed = input.trim();
		if (!trimmed || disabled) {
			return;
		}
		onSend(trimmed);
		setInput("");
	}, [input, disabled, onSend]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	useEffect(() => {
		const el = textareaRef.current;
		if (el) {
			el.style.height = "auto";
			el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
		}
	}, [input]);

	return (
		<div
			style={{
				borderTop: "1px solid var(--ai-eyes-border, #e5e5e5)",
				padding: 12,
			}}
		>
			{suggestions && suggestions.length > 0 && (
				<div
					style={{
						display: "flex",
						gap: 6,
						flexWrap: "wrap",
						marginBottom: 8,
					}}
				>
					{suggestions.map((chip) => (
						<button
							key={chip.label}
							type="button"
							onClick={() => onSend(chip.message)}
							disabled={disabled}
							style={{
								padding: "4px 10px",
								borderRadius: 20,
								border: "1px solid var(--ai-eyes-border, #e5e5e5)",
								background: "transparent",
								color: "var(--ai-eyes-panel-fg, inherit)",
								fontSize: 11,
								cursor: "pointer",
								opacity: disabled ? 0.5 : 1,
							}}
						>
							{chip.label}
						</button>
					))}
				</div>
			)}

			<div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
				<textarea
					ref={textareaRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder ?? "Ask me anything..."}
					disabled={disabled}
					rows={1}
					style={{
						flex: 1,
						resize: "none",
						border: "1px solid var(--ai-eyes-border, #e5e5e5)",
						borderRadius: 12,
						padding: "8px 12px",
						fontSize: 13,
						lineHeight: 1.5,
						background: "var(--ai-eyes-input-bg, transparent)",
						color: "var(--ai-eyes-panel-fg, inherit)",
						outline: "none",
						fontFamily: "inherit",
						overflow: "hidden",
					}}
				/>
				<button
					type="button"
					onClick={handleSend}
					disabled={disabled || !input.trim()}
					style={{
						width: 36,
						height: 36,
						borderRadius: 10,
						border: "none",
						background:
							input.trim() && !disabled
								? "var(--ai-eyes-accent, #111)"
								: "var(--ai-eyes-border, #e5e5e5)",
						color: "var(--ai-eyes-accent-fg, #fff)",
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
						transition: "background 0.15s",
					}}
					aria-label="Send"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						aria-hidden="true"
					>
						<title>Send</title>
						<path
							d="M3 13L13 8L3 3V7L9 8L3 9V13Z"
							fill="currentColor"
						/>
					</svg>
				</button>
			</div>
		</div>
	);
}
