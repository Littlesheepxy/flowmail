"use client";

import type { HelpSuggestion } from "@ai-eyes/core";
import { useEffect, useRef, useState } from "react";

interface HelpBubbleProps {
	suggestion: HelpSuggestion;
	onAccept: () => void;
	onDismiss: () => void;
	position: "above" | "left";
	locale?: {
		accept?: string;
		dismiss?: string;
	};
}

export function HelpBubble({
	suggestion,
	onAccept,
	onDismiss,
	position,
	locale,
}: HelpBubbleProps) {
	const [visible, setVisible] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout>>();

	useEffect(() => {
		requestAnimationFrame(() => setVisible(true));

		timerRef.current = setTimeout(() => {
			setVisible(false);
			setTimeout(onDismiss, 300);
		}, 8000);

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, [onDismiss]);

	const positionStyles: React.CSSProperties =
		position === "above"
			? { bottom: "calc(100% + 12px)", right: 0 }
			: { right: "calc(100% + 12px)", bottom: 0 };

	return (
		<div
			style={{
				position: "absolute",
				...positionStyles,
				width: 280,
				zIndex: 10,
				opacity: visible ? 1 : 0,
				transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.95)",
				transition: "opacity 0.3s, transform 0.3s",
				pointerEvents: visible ? "auto" : "none",
			}}
		>
			<div
				style={{
					background: "var(--ai-eyes-bubble-bg, white)",
					color: "var(--ai-eyes-bubble-fg, #111)",
					border: "1px solid var(--ai-eyes-bubble-border, #e5e5e5)",
					borderRadius: 14,
					padding: "14px 16px",
					boxShadow: "0 8px 30px -4px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
					fontSize: 13,
					lineHeight: 1.6,
				}}
			>
				<p style={{ margin: 0 }}>{suggestion.message}</p>

				<div
					style={{
						display: "flex",
						gap: 8,
						marginTop: 12,
					}}
				>
					<button
						type="button"
						onClick={() => {
							if (timerRef.current) {
								clearTimeout(timerRef.current);
							}
							onAccept();
						}}
						style={{
							flex: 1,
							padding: "6px 12px",
							borderRadius: 8,
							border: "none",
							background: "var(--ai-eyes-accent, #111)",
							color: "var(--ai-eyes-accent-fg, #fff)",
							fontSize: 12,
							fontWeight: 500,
							cursor: "pointer",
						}}
					>
						{locale?.accept ?? "Help me"}
					</button>
					<button
						type="button"
						onClick={() => {
							if (timerRef.current) {
								clearTimeout(timerRef.current);
							}
							setVisible(false);
							setTimeout(onDismiss, 300);
						}}
						style={{
							padding: "6px 12px",
							borderRadius: 8,
							border: "1px solid var(--ai-eyes-bubble-border, #e5e5e5)",
							background: "transparent",
							color: "var(--ai-eyes-bubble-fg, #111)",
							fontSize: 12,
							fontWeight: 500,
							cursor: "pointer",
							opacity: 0.7,
						}}
					>
						{locale?.dismiss ?? "No thanks"}
					</button>
				</div>
			</div>
		</div>
	);
}
