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
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const progressRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		requestAnimationFrame(() => setVisible(true));

		timerRef.current = setTimeout(() => {
			setVisible(false);
			setTimeout(onDismiss, 300);
		}, 10000);

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

	const acceptLabel =
		suggestion.suggestedMessage ?? locale?.accept ?? "帮我解决";

	return (
		<div
			style={{
				position: "absolute",
				...positionStyles,
				width: 290,
				zIndex: 10,
				opacity: visible ? 1 : 0,
				transform: visible
					? "translateY(0) scale(1)"
					: "translateY(8px) scale(0.95)",
				transition: "opacity 0.3s ease, transform 0.3s ease",
				pointerEvents: visible ? "auto" : "none",
			}}
		>
			<div
				style={{
					background: "var(--ai-eyes-bubble-bg, hsl(var(--card)))",
					color: "var(--ai-eyes-bubble-fg, hsl(var(--card-foreground)))",
					border: "1px solid var(--ai-eyes-bubble-border, hsl(var(--border)))",
					borderRadius: 16,
					padding: "14px 16px 12px",
					boxShadow:
						"0 8px 30px -4px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)",
					fontSize: 13,
					lineHeight: 1.6,
					position: "relative",
					overflow: "hidden",
				}}
			>
				{/* Animated accent bar at top */}
				<div
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						height: 2,
						background:
							"linear-gradient(90deg, var(--ai-eyes-accent, hsl(var(--primary))), transparent)",
						opacity: 0.6,
					}}
				/>

				{/* Auto-dismiss progress bar */}
				<div
					ref={progressRef}
					style={{
						position: "absolute",
						bottom: 0,
						left: 0,
						height: 2,
						background:
							"var(--ai-eyes-accent, hsl(var(--primary)))",
						opacity: 0.3,
						animation: visible
							? "ai-eyes-progress 10s linear forwards"
							: "none",
					}}
				/>

				<p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
					{suggestion.message}
				</p>

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
							padding: "7px 14px",
							borderRadius: 10,
							border: "none",
							background:
								"var(--ai-eyes-accent, hsl(var(--primary)))",
							color: "var(--ai-eyes-accent-fg, hsl(var(--primary-foreground)))",
							fontSize: 12,
							fontWeight: 500,
							cursor: "pointer",
							transition: "opacity 0.15s",
						}}
						onMouseEnter={(e) => {
							(e.target as HTMLElement).style.opacity = "0.9";
						}}
						onMouseLeave={(e) => {
							(e.target as HTMLElement).style.opacity = "1";
						}}
					>
						{acceptLabel}
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
							padding: "7px 14px",
							borderRadius: 10,
							border: "1px solid var(--ai-eyes-bubble-border, hsl(var(--border)))",
							background: "transparent",
							color: "var(--ai-eyes-bubble-fg, hsl(var(--card-foreground)))",
							fontSize: 12,
							fontWeight: 500,
							cursor: "pointer",
							opacity: 0.6,
							transition: "opacity 0.15s",
						}}
						onMouseEnter={(e) => {
							(e.target as HTMLElement).style.opacity = "0.9";
						}}
						onMouseLeave={(e) => {
							(e.target as HTMLElement).style.opacity = "0.6";
						}}
					>
						{locale?.dismiss ?? "知道了"}
					</button>
				</div>
			</div>

			<style>{`
				@keyframes ai-eyes-progress {
					from { width: 100%; }
					to { width: 0%; }
				}
			`}</style>
		</div>
	);
}
