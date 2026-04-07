"use client";

import type { EyeState, OrbMood } from "../hooks/use-orb-animation";

interface OrbDotsProps {
	size: number;
	offsetX: number;
	offsetY: number;
	eyeState: EyeState;
	leftEyeR: number;
	rightEyeR: number;
	leftBreathe: number;
	rightBreathe: number;
	brightness: number;
	glowIntensity: number;
	mood: OrbMood;
	isHovered: boolean;
}

/*
 * 36x36 viewBox. Face layout:
 *   Eyes Y:  14.5
 *   Left eye X: 12, Right eye X: 24
 *   Mouth Y: ~22-23
 *
 * Eye rendering uses Cassie Evans-style opacity switching:
 *   - open = <circle> (visible), closed arc (hidden)
 *   - closed = <circle> (hidden), closed arc <path> (visible)
 */

const EYE_CY = 14.5;
const EYE_LEFT_CX = 12;
const EYE_RIGHT_CX = 24;

const CLOSED_ARC_LEFT = "M9 14.5 Q12 17 15 14.5";
const CLOSED_ARC_RIGHT = "M21 14.5 Q24 17 27 14.5";

function getMouthPath(mood: OrbMood, isHovered: boolean): string | null {
	switch (mood) {
		case "happy":
			return "M11 22 Q18 29 25 22";
		case "alert":
			return "M14 23 Q18 20.5 22 23";
		case "thinking":
			return "M14 23 Q16 24.5 18 23 Q20 21.5 22 23";
		case "confused":
			return "M14 22.5 Q16 24 18 23.5 Q20 22 22 23";
		case "curious":
			return "M15 23 Q18 21 21 23";
		case "sad":
			return "M13 24 Q18 21 23 24";
		case "watching":
			return isHovered ? "M12 22.5 Q18 27 24 22.5" : "M13 23 Q18 26 23 23";
		case "wink":
			return "M12 22.5 Q18 27 24 22.5";
		case "sleeping":
			return null;
		case "idle":
		default:
			return "M13 23 Q18 25.5 23 23";
	}
}

function MoodExtras({ mood }: { mood: OrbMood }) {
	if (mood === "thinking") {
		return (
			<g opacity="0.45">
				<circle cx="29" cy="9" r="0.9" fill="currentColor">
					<animate
						attributeName="opacity"
						values="0.2;0.7;0.2"
						dur="1.5s"
						repeatCount="indefinite"
					/>
				</circle>
				<circle cx="31.5" cy="6.5" r="0.7" fill="currentColor">
					<animate
						attributeName="opacity"
						values="0.2;0.7;0.2"
						dur="1.5s"
						begin="0.3s"
						repeatCount="indefinite"
					/>
				</circle>
			</g>
		);
	}
	if (mood === "confused") {
		return (
			<g opacity="0.4" fill="currentColor" fontSize="5.5" fontWeight="700">
				<text x="27" y="10">
					?
					<animate
						attributeName="opacity"
						values="0.2;0.6;0.2"
						dur="2s"
						repeatCount="indefinite"
					/>
					<animateTransform
						attributeName="transform"
						type="translate"
						values="0 0;0.5 -1.5;0 0"
						dur="2s"
						repeatCount="indefinite"
					/>
				</text>
			</g>
		);
	}
	if (mood === "sleeping") {
		return (
			<g
				opacity="0.35"
				fontSize="4.5"
				fontWeight="700"
				fill="currentColor"
			>
				<text x="27" y="11">
					z
					<animate
						attributeName="opacity"
						values="0.15;0.5;0.15"
						dur="2.2s"
						repeatCount="indefinite"
					/>
					<animateTransform
						attributeName="transform"
						type="translate"
						values="0 0;1 -2;0 0"
						dur="2.2s"
						repeatCount="indefinite"
					/>
				</text>
				<text x="30" y="8" fontSize="3.5">
					z
					<animate
						attributeName="opacity"
						values="0.15;0.5;0.15"
						dur="2.2s"
						begin="0.5s"
						repeatCount="indefinite"
					/>
					<animateTransform
						attributeName="transform"
						type="translate"
						values="0 0;0.8 -1.5;0 0"
						dur="2.2s"
						begin="0.5s"
						repeatCount="indefinite"
					/>
				</text>
			</g>
		);
	}
	return null;
}

export function OrbDots({
	size,
	offsetX,
	offsetY,
	eyeState,
	leftEyeR,
	rightEyeR,
	leftBreathe,
	rightBreathe,
	brightness,
	glowIntensity,
	mood,
	isHovered,
}: OrbDotsProps) {
	const clampedOX = Math.max(-3, Math.min(3, offsetX));
	const clampedOY = Math.max(-2.5, Math.min(2.5, offsetY));

	const leftBreatheDY = (leftBreathe - 0.5) * 0.8;
	const rightBreatheDY = (rightBreathe - 0.5) * 0.6;
	const containerScale = 1 + (leftBreathe - 0.5) * 0.015;

	const hoverGlow = isHovered ? 1.3 : 1;
	const glow = glowIntensity * hoverGlow;
	const mouthPath = getMouthPath(mood, isHovered);

	const ringAlpha = isHovered ? 0.18 * glow : 0.1 * glow;
	const shadow = `0 2px 10px rgba(0,0,0,${Math.min(0.15, 0.06 * glow)}), 0 0 0 1px rgba(150,150,150,${ringAlpha})`;

	const leftOpen = eyeState === "open" || eyeState === "wink-right";
	const rightOpen = eyeState === "open";

	const eyeOffsetX = clampedOX * 1.2;
	const eyeOffsetY = clampedOY * 1.2;
	const mouthOffsetX = clampedOX * 0.5;
	const mouthOffsetY = clampedOY * 0.5;
	const extrasOffsetX = clampedOX * 0.3;
	const extrasOffsetY = clampedOY * 0.3;

	const dotColor = "var(--ai-eyes-dot, #1a1a1a)";

	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: "50%",
				background: "var(--ai-eyes-bg, #fff)",
				boxShadow: shadow,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				transform: `scale(${containerScale})`,
				transition: "box-shadow 0.3s, transform 0.8s ease-in-out",
				filter: `brightness(${brightness})`,
				position: "relative",
			}}
		>
			<svg
				viewBox="0 0 36 36"
				width={size * 0.72}
				height={size * 0.72}
				style={{ overflow: "visible" }}
				role="img"
				aria-label="AI assistant"
			>
				<title>AI Assistant</title>

				{/* === Eyes layer (highest parallax) === */}
				<g
					style={{
						transform: `translate(${eyeOffsetX}px, ${eyeOffsetY}px)`,
						transition: "transform 0.15s ease-out",
					}}
				>
					{/* Left eye — open state (circle) */}
					{leftOpen && (
						<circle
							cx={EYE_LEFT_CX}
							cy={EYE_CY + leftBreatheDY}
							r={leftEyeR}
							fill={dotColor}
							style={{
								transition: "r 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
							}}
						/>
					)}
					{/* Left eye — closed state (arc) */}
					{!leftOpen && (
						<path
							d={CLOSED_ARC_LEFT}
							fill="none"
							stroke={dotColor}
							strokeWidth="2"
							strokeLinecap="round"
							style={{
								transform: `translateY(${leftBreatheDY}px)`,
							}}
						/>
					)}

					{/* Right eye — open state (circle) */}
					{rightOpen && (
						<circle
							cx={EYE_RIGHT_CX}
							cy={EYE_CY + rightBreatheDY}
							r={rightEyeR}
							fill={dotColor}
							style={{
								transition: "r 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
							}}
						/>
					)}
					{/* Right eye — closed state (arc) */}
					{!rightOpen && (
						<path
							d={CLOSED_ARC_RIGHT}
							fill="none"
							stroke={dotColor}
							strokeWidth="2"
							strokeLinecap="round"
							style={{
								transform: `translateY(${rightBreatheDY}px)`,
							}}
						/>
					)}
				</g>

				{/* === Mouth layer (medium parallax) === */}
				<g
					style={{
						transform: `translate(${mouthOffsetX}px, ${mouthOffsetY}px)`,
						transition: "transform 0.15s ease-out",
					}}
				>
					{mouthPath && mood !== "curious" && (
						<path
							d={mouthPath}
							fill="none"
							stroke={dotColor}
							strokeWidth="1.8"
							strokeLinecap="round"
							style={{ transition: "d 0.25s ease-out" }}
						/>
					)}

					{/* Curious mouth — small O */}
					{mood === "curious" && (
						<circle
							cx="18"
							cy="23"
							r="2"
							fill="none"
							stroke={dotColor}
							strokeWidth="1.5"
						/>
					)}

					{/* Sleeping mouth — flat line */}
					{mood === "sleeping" && (
						<line
							x1="14"
							y1="23"
							x2="22"
							y2="23"
							stroke={dotColor}
							strokeWidth="1.5"
							strokeLinecap="round"
							opacity="0.45"
						/>
					)}
				</g>

				{/* === Extras layer (lowest parallax) === */}
				<g
					style={{
						transform: `translate(${extrasOffsetX}px, ${extrasOffsetY}px)`,
						transition: "transform 0.15s ease-out",
					}}
				>
					<MoodExtras mood={mood} />
				</g>
			</svg>
		</div>
	);
}
