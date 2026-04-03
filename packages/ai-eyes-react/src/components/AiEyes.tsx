"use client";

import type { HelpSuggestion } from "@ai-eyes/core";
import { useCallback, useRef, useState } from "react";
import type { EyeMood } from "../hooks/use-eye-animation";
import { useEyeAnimation } from "../hooks/use-eye-animation";
import { useDragPosition } from "../hooks/use-drag-position";
import { useMouseTracker } from "../hooks/use-mouse-tracker";
import { useAiEyes } from "../provider/AiEyesProvider";
import { EyeSvg } from "./EyeSvg";
import { HelpBubble } from "./HelpBubble";

export interface AiEyesPosition {
	x: number;
	y: number;
}

export interface AiEyesProps {
	size?: number;
	position?: "bottom-right" | "bottom-left" | "custom";
	draggable?: boolean;
	onClick?: () => void;
	onHelpAccepted?: (suggestion: HelpSuggestion) => void;
	onHelpDismissed?: () => void;
	onPositionChange?: (pos: AiEyesPosition) => void;
	/** Override mood from outside */
	mood?: EyeMood;
	disabled?: boolean;
	className?: string;
	style?: React.CSSProperties;
	locale?: {
		helpAccept?: string;
		helpDismiss?: string;
	};
}

export function AiEyes({
	size = 48,
	position = "bottom-right",
	draggable = true,
	onClick,
	onHelpAccepted,
	onHelpDismissed,
	onPositionChange,
	mood: externalMood,
	disabled,
	className,
	style,
	locale,
}: AiEyesProps) {
	const { mood: ctxMood, activeSuggestion, setActiveSuggestion, setMood } =
		useAiEyes();
	const effectiveMood = externalMood ?? ctxMood;

	const containerRef = useRef<HTMLDivElement>(null);
	const [isHovered, setIsHovered] = useState(false);

	const animation = useEyeAnimation(effectiveMood);
	const pupil = useMouseTracker(containerRef, {
		maxOffset: size * 0.065,
		smoothing: 0.15,
		deadZone: 50,
		active: effectiveMood === "watching" || effectiveMood === "alert",
	});

	const defaultPos =
		position === "bottom-right"
			? {
					x: typeof window !== "undefined" ? window.innerWidth - size - 24 : 0,
					y: typeof window !== "undefined" ? window.innerHeight - size - 24 : 0,
				}
			: position === "bottom-left"
				? {
						x: 24,
						y: typeof window !== "undefined" ? window.innerHeight - size - 24 : 0,
					}
				: undefined;

	const { position: dragPos, isDragging, handlePointerDown } = useDragPosition(
		draggable && position !== "custom",
		defaultPos,
		onPositionChange,
	);

	const handleClick = useCallback(() => {
		if (isDragging || disabled) {
			return;
		}
		setMood("wink");
		setTimeout(() => setMood("watching"), 400);
		onClick?.();
	}, [isDragging, disabled, onClick, setMood]);

	const handleHelpAccept = useCallback(() => {
		if (!activeSuggestion) {
			return;
		}
		setMood("happy");
		onHelpAccepted?.(activeSuggestion);
		setActiveSuggestion(null);
		setTimeout(() => setMood("watching"), 1500);
	}, [activeSuggestion, onHelpAccepted, setActiveSuggestion, setMood]);

	const handleHelpDismiss = useCallback(() => {
		setActiveSuggestion(null);
		setMood("idle");
		onHelpDismissed?.();
	}, [setActiveSuggestion, setMood, onHelpDismissed]);

	if (disabled) {
		return null;
	}

	const positionStyle: React.CSSProperties =
		position === "custom"
			? {}
			: {
					position: "fixed",
					left: dragPos.x,
					top: dragPos.y,
					zIndex: 9999,
				};

	return (
		<button
			ref={containerRef as React.RefObject<HTMLButtonElement>}
			type="button"
			className={className}
			style={{
				...positionStyle,
				width: size,
				height: size,
				cursor: isDragging ? "grabbing" : "pointer",
				userSelect: "none",
				touchAction: "none",
				transition: isDragging ? "none" : "filter 0.2s",
				filter: isHovered ? "drop-shadow(0 2px 8px rgba(0,0,0,0.15))" : "none",
				background: "none",
				border: "none",
				padding: 0,
				outline: "none",
				...style,
			}}
			onPointerDown={handlePointerDown}
			onClick={handleClick}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			aria-label="AI Assistant"
		>
			<EyeSvg
				size={size}
				pupilX={pupil.x}
				pupilY={pupil.y}
				leftEyeScale={animation.leftEyeScale}
				rightEyeScale={animation.rightEyeScale}
				mouthPath={animation.mouthPath}
				pupilScale={animation.pupilScale}
				mood={animation.mood}
				bodyBounce={animation.bodyBounce}
				isHovered={isHovered}
			/>

			{activeSuggestion && (
				<HelpBubble
					suggestion={activeSuggestion}
					onAccept={handleHelpAccept}
					onDismiss={handleHelpDismiss}
					position="above"
					locale={{
						accept: locale?.helpAccept,
						dismiss: locale?.helpDismiss,
					}}
				/>
			)}
		</button>
	);
}
