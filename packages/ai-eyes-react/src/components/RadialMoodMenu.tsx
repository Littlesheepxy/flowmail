"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbMood } from "../hooks/use-orb-animation";
import { OrbDots } from "./OrbDots";

export interface RadialMenuItem {
	id: string;
	label: string;
	mood: OrbMood;
	icon?: React.ReactNode;
}

interface RadialMoodMenuProps {
	open: boolean;
	onClose: () => void;
	onSelect: (item: RadialMenuItem) => void;
	onHover?: (item: RadialMenuItem | null) => void;
	items: RadialMenuItem[];
	anchorSize: number;
}

const FACE_SIZE = 26;
const INNER_RADIUS = 56;
const DIVIDER_RADIUS = 78;
const LABEL_RADIUS = 102;
const OUTER_RADIUS = 126;

function getStaticEyeProps(mood: OrbMood) {
	const base = {
		size: FACE_SIZE,
		offsetX: 0,
		offsetY: 0,
		eyeState: "open" as const,
		leftEyeR: 3,
		rightEyeR: 3,
		leftBreathe: 0.5,
		rightBreathe: 0.5,
		brightness: 1,
		glowIntensity: 0.7,
		mood,
		isHovered: false,
	};

	switch (mood) {
		case "sleeping":
		case "happy":
			return { ...base, eyeState: "closed" as const };
		case "wink":
			return { ...base, eyeState: "wink-right" as const };
		case "curious":
		case "alert":
			return { ...base, leftEyeR: 3.5, rightEyeR: 3.5 };
		case "thinking":
		case "confused":
			return { ...base, rightEyeR: 2.5 };
		case "sad":
			return { ...base, leftEyeR: 2.8, rightEyeR: 2.8 };
		default:
			return base;
	}
}

function SectorDividers({
	count,
	center,
	animateIn,
}: {
	count: number;
	center: number;
	animateIn: boolean;
}) {
	const angleStep = (2 * Math.PI) / count;
	const startAngle = -Math.PI / 2 - angleStep / 2;

	return (
		<svg
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				zIndex: 1,
			}}
		>
			<title>Menu dividers</title>
			<circle
				cx={center}
				cy={center}
				r={DIVIDER_RADIUS}
				fill="none"
				stroke="var(--ai-eyes-menu-divider, rgba(0,0,0,0.08))"
				strokeWidth="1"
				style={{
					opacity: animateIn ? 1 : 0,
					transition: "opacity 0.2s ease-out 0.1s",
				}}
			/>
			{Array.from({ length: count }).map((_, i) => {
				const angle = startAngle + i * angleStep;
				const x1 = center + Math.cos(angle) * (INNER_RADIUS - 8);
				const y1 = center + Math.sin(angle) * (INNER_RADIUS - 8);
				const x2 = center + Math.cos(angle) * OUTER_RADIUS;
				const y2 = center + Math.sin(angle) * OUTER_RADIUS;
				return (
					<line
						key={`div-${angle.toFixed(3)}`}
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
						stroke="var(--ai-eyes-menu-divider, rgba(0,0,0,0.06))"
						strokeWidth="1"
						style={{
							opacity: animateIn ? 1 : 0,
							transition: `opacity 0.2s ease-out ${0.05 + i * 0.02}s`,
						}}
					/>
				);
			})}
		</svg>
	);
}

function getHoveredIndex(
	mouseX: number,
	mouseY: number,
	center: number,
	count: number,
): number | null {
	const dx = mouseX - center;
	const dy = mouseY - center;
	const dist = Math.sqrt(dx * dx + dy * dy);

	if (dist < INNER_RADIUS - 12 || dist > OUTER_RADIUS + 4) {
		return null;
	}

	const angle = Math.atan2(dy, dx);
	const startAngle = -Math.PI / 2;
	let relative = angle - startAngle;
	if (relative < 0) {
		relative += 2 * Math.PI;
	}

	const step = (2 * Math.PI) / count;
	const index = Math.floor((relative + step / 2) / step) % count;
	return index;
}

export function RadialMoodMenu({
	open,
	onClose,
	onSelect,
	onHover,
	items,
	anchorSize,
}: RadialMoodMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [animateIn, setAnimateIn] = useState(false);

	useEffect(() => {
		if (open) {
			requestAnimationFrame(() => setAnimateIn(true));
		} else {
			setAnimateIn(false);
			setHoveredIndex(null);
		}
	}, [open]);

	const menuSize = OUTER_RADIUS * 2 + 16;
	const center = menuSize / 2;

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const rect = e.currentTarget.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;
			const idx = getHoveredIndex(mx, my, center, items.length);

			setHoveredIndex((prev) => {
				if (prev === idx) {
					return prev;
				}
				onHover?.(idx !== null ? items[idx] : null);
				return idx;
			});
		},
		[center, items, onHover],
	);

	const handleMouseLeave = useCallback(() => {
		setHoveredIndex(null);
		onHover?.(null);
	}, [onHover]);

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const rect = e.currentTarget.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;
			const idx = getHoveredIndex(mx, my, center, items.length);

			if (idx !== null) {
				e.stopPropagation();
				onSelect(items[idx]);
			}
		},
		[center, items, onSelect],
	);

	const handleClickOutside = useCallback(
		(e: MouseEvent) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(e.target as Node)
			) {
				onClose();
			}
		},
		[onClose],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		},
		[onClose],
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open, handleClickOutside, handleKeyDown]);

	if (!open) {
		return null;
	}

	const angleStep = (2 * Math.PI) / items.length;
	const startAngle = -Math.PI / 2;

	return (
		<div
			ref={menuRef}
			role="menu"
			tabIndex={0}
			style={{
				position: "absolute",
				width: menuSize,
				height: menuSize,
				left: (anchorSize - menuSize) / 2,
				top: (anchorSize - menuSize) / 2,
				zIndex: 10000,
				cursor: "pointer",
				outline: "none",
			}}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					onClose();
				} else if (e.key === "Enter" && hoveredIndex !== null) {
					onSelect(items[hoveredIndex]);
				}
			}}
		>
			{/* Outer backdrop */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					borderRadius: "50%",
					background:
						"var(--ai-eyes-menu-bg, rgba(255,255,255,0.92))",
					backdropFilter: "blur(16px)",
					boxShadow:
						"0 8px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
					transform: animateIn ? "scale(1)" : "scale(0.2)",
					opacity: animateIn ? 1 : 0,
					transition:
						"transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease-out",
					pointerEvents: "none",
				}}
			/>

			{/* Center area */}
			<div
				style={{
					position: "absolute",
					left: center - INNER_RADIUS + 8,
					top: center - INNER_RADIUS + 8,
					width: (INNER_RADIUS - 8) * 2,
					height: (INNER_RADIUS - 8) * 2,
					borderRadius: "50%",
					background:
						"var(--ai-eyes-menu-center, rgba(255,255,255,1))",
					boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
					transform: animateIn ? "scale(1)" : "scale(0)",
					opacity: animateIn ? 1 : 0,
					transition:
						"transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s, opacity 0.15s ease-out 0.05s",
					zIndex: 2,
					pointerEvents: "none",
				}}
			/>

			{/* Sector highlight */}
			{hoveredIndex !== null && (
				<SectorHighlight
					index={hoveredIndex}
					count={items.length}
					center={center}
				/>
			)}

			<SectorDividers
				count={items.length}
				center={center}
				animateIn={animateIn}
			/>

			{/* Faces + Labels */}
			{items.map((item, i) => {
				const angle = startAngle + i * angleStep;
				const isHovered = hoveredIndex === i;

				const faceX =
					center + Math.cos(angle) * INNER_RADIUS - FACE_SIZE / 2;
				const faceY =
					center + Math.sin(angle) * INNER_RADIUS - FACE_SIZE / 2;

				const labelX = center + Math.cos(angle) * LABEL_RADIUS;
				const labelY = center + Math.sin(angle) * LABEL_RADIUS;

				return (
					<div key={item.id} style={{ pointerEvents: "none" }}>
						<div
							style={{
								position: "absolute",
								left: faceX,
								top: faceY,
								width: FACE_SIZE,
								height: FACE_SIZE,
								transform: animateIn
									? `scale(${isHovered ? 1.2 : 1})`
									: "scale(0)",
								opacity: animateIn ? 1 : 0,
								transition: `transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 25}ms, opacity 0.15s ease-out ${i * 25}ms`,
								zIndex: 4,
							}}
						>
							<OrbDots {...getStaticEyeProps(item.mood)} />
						</div>

						<span
							style={{
								position: "absolute",
								left: labelX,
								top: labelY,
								transform: "translate(-50%, -50%)",
								fontSize: 11,
								fontWeight: isHovered ? 600 : 500,
								letterSpacing: "0.01em",
								color: isHovered
									? "var(--ai-eyes-menu-text-hover, #000)"
									: "var(--ai-eyes-menu-text, #555)",
								whiteSpace: "nowrap",
								opacity: animateIn ? 1 : 0,
								transition: `opacity 0.2s ease-out ${i * 25 + 80}ms, color 0.15s, font-weight 0.15s`,
								userSelect: "none",
								zIndex: 4,
							}}
						>
							{item.label}
						</span>
					</div>
				);
			})}
		</div>
	);
}

function SectorHighlight({
	index,
	count,
	center,
}: {
	index: number;
	count: number;
	center: number;
}) {
	const step = (2 * Math.PI) / count;
	const startAngle = -Math.PI / 2;
	const a1 = startAngle + index * step - step / 2;
	const a2 = a1 + step;
	const ir = INNER_RADIUS - 8;
	const or = OUTER_RADIUS;

	const x1i = center + Math.cos(a1) * ir;
	const y1i = center + Math.sin(a1) * ir;
	const x1o = center + Math.cos(a1) * or;
	const y1o = center + Math.sin(a1) * or;
	const x2i = center + Math.cos(a2) * ir;
	const y2i = center + Math.sin(a2) * ir;
	const x2o = center + Math.cos(a2) * or;
	const y2o = center + Math.sin(a2) * or;

	const largeArc = step > Math.PI ? 1 : 0;
	const d = [
		`M${x1i} ${y1i}`,
		`L${x1o} ${y1o}`,
		`A${or} ${or} 0 ${largeArc} 1 ${x2o} ${y2o}`,
		`L${x2i} ${y2i}`,
		`A${ir} ${ir} 0 ${largeArc} 0 ${x1i} ${y1i}`,
		"Z",
	].join(" ");

	return (
		<svg
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				zIndex: 1,
			}}
		>
			<title>Highlight</title>
			<path
				d={d}
				fill="var(--ai-eyes-menu-hover, rgba(0,0,0,0.05))"
				style={{ transition: "d 0.1s ease-out" }}
			/>
		</svg>
	);
}

export const DEFAULT_RADIAL_ITEMS: RadialMenuItem[] = [
	{ id: "ask", label: "问一下", mood: "curious" },
	{ id: "analyze", label: "帮我看", mood: "thinking" },
	{ id: "bookmark", label: "记录此刻", mood: "wink" },
	{ id: "history", label: "查看记录", mood: "watching" },
	{ id: "share", label: "分享上下文", mood: "happy" },
	{ id: "feedback", label: "反馈", mood: "confused" },
	{ id: "pause", label: "暂停监测", mood: "sleeping" },
	{ id: "settings", label: "设置", mood: "idle" },
];
