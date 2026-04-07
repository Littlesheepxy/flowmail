"use client";

import type { EyeMood } from "../hooks/use-eye-animation";

interface EyeSvgProps {
	size: number;
	pupilX: number;
	pupilY: number;
	leftEyeScale: { x: number; y: number };
	rightEyeScale: { x: number; y: number };
	mouthPath: string;
	pupilScale: number;
	mood: EyeMood;
	bodyBounce: number;
	isHovered: boolean;
}

export function EyeSvg({
	size,
	pupilX,
	pupilY,
	leftEyeScale,
	rightEyeScale,
	mouthPath,
	pupilScale,
	mood,
	bodyBounce,
	isHovered,
}: EyeSvgProps) {
	const effectivePupilScale = isHovered ? pupilScale * 1.15 : pupilScale;
	const pupilR = 3.5 * effectivePupilScale;
	const highlightR = 1.2 * effectivePupilScale;
	const bounceY = -bodyBounce * 2;

	return (
		<svg
			viewBox="0 0 48 48"
			width={size}
			height={size}
			role="img"
			aria-label="AI Eye"
			style={{ overflow: "visible" }}
		>
			<g transform={`translate(0, ${bounceY})`}>
				{/* Face bg */}
				<ellipse
					cx="24"
					cy="25"
					rx="22"
					ry="21"
					fill="currentColor"
					opacity="0.06"
					style={{ transition: "opacity 0.3s" }}
				/>

				{/* Left eye */}
				<g
					style={{
						transform: `scale(${leftEyeScale.x}, ${leftEyeScale.y})`,
						transformOrigin: "15px 22px",
						transition: "transform 0.12s ease-out",
					}}
				>
					<ellipse
						cx="15"
						cy="22"
						rx="7.5"
						ry="8.5"
						fill="white"
						stroke="currentColor"
						strokeWidth="1.2"
						opacity="0.95"
					/>
					{pupilScale > 0 && (
						<>
							<circle
								cx={15 + pupilX * 0.9}
								cy={
									22 +
									pupilY * 0.9 +
									(mood === "thinking" ? -2 : 0)
								}
								r={pupilR}
								fill="currentColor"
								style={{ transition: "r 0.2s" }}
							/>
							<circle
								cx={13.5 + pupilX * 0.3}
								cy={
									20 +
									pupilY * 0.3 +
									(mood === "thinking" ? -1 : 0)
								}
								r={highlightR}
								fill="white"
								opacity="0.9"
							/>
						</>
					)}
				</g>

				{/* Right eye */}
				<g
					style={{
						transform: `scale(${rightEyeScale.x}, ${rightEyeScale.y})`,
						transformOrigin: "33px 22px",
						transition: "transform 0.12s ease-out",
					}}
				>
					<ellipse
						cx="33"
						cy="22"
						rx="7.5"
						ry="8.5"
						fill="white"
						stroke="currentColor"
						strokeWidth="1.2"
						opacity="0.95"
					/>
					{pupilScale > 0 && (
						<>
							<circle
								cx={33 + pupilX * 0.9}
								cy={
									22 +
									pupilY * 0.9 +
									(mood === "thinking" ? -2 : 0)
								}
								r={pupilR}
								fill="currentColor"
								style={{ transition: "r 0.2s" }}
							/>
							<circle
								cx={31.5 + pupilX * 0.3}
								cy={
									20 +
									pupilY * 0.3 +
									(mood === "thinking" ? -1 : 0)
								}
								r={highlightR}
								fill="white"
								opacity="0.9"
							/>
						</>
					)}
				</g>

				{/* Mouth */}
				<path
					d={mouthPath}
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					style={{ transition: "d 0.3s ease-out" }}
				/>

				{/* Thinking dots */}
				{mood === "thinking" && (
					<g opacity="0.5">
						<circle cx="40" cy="14" r="1.2" fill="currentColor">
							<animate
								attributeName="opacity"
								values="0.3;1;0.3"
								dur="1.2s"
								repeatCount="indefinite"
							/>
						</circle>
						<circle cx="43" cy="11" r="1" fill="currentColor">
							<animate
								attributeName="opacity"
								values="0.3;1;0.3"
								dur="1.2s"
								begin="0.2s"
								repeatCount="indefinite"
							/>
						</circle>
						<circle cx="45.5" cy="8.5" r="0.8" fill="currentColor">
							<animate
								attributeName="opacity"
								values="0.3;1;0.3"
								dur="1.2s"
								begin="0.4s"
								repeatCount="indefinite"
							/>
						</circle>
					</g>
				)}

				{/* Sleeping zzz */}
				{mood === "sleeping" && (
					<g
						opacity="0.4"
						fontSize="6"
						fontWeight="bold"
						fill="currentColor"
					>
						<text x="36" y="14">
							z
							<animate
								attributeName="opacity"
								values="0.2;0.6;0.2"
								dur="2s"
								repeatCount="indefinite"
							/>
							<animateTransform
								attributeName="transform"
								type="translate"
								values="0 0;2 -3;0 0"
								dur="2s"
								repeatCount="indefinite"
							/>
						</text>
						<text x="40" y="9" fontSize="5">
							z
							<animate
								attributeName="opacity"
								values="0.2;0.6;0.2"
								dur="2s"
								begin="0.5s"
								repeatCount="indefinite"
							/>
							<animateTransform
								attributeName="transform"
								type="translate"
								values="0 0;1.5 -2;0 0"
								dur="2s"
								begin="0.5s"
								repeatCount="indefinite"
							/>
						</text>
					</g>
				)}

				{/* Alert eyebrows */}
				{mood === "alert" && (
					<>
						<line
							x1="9"
							y1="12"
							x2="17"
							y2="14"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
						/>
						<line
							x1="31"
							y1="14"
							x2="39"
							y2="12"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
						/>
					</>
				)}
			</g>
		</svg>
	);
}
