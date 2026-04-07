"use client";

import type { HelpSuggestion } from "@ai-eyes/core";
import { useCallback, useRef, useState } from "react";
import type { OrbMood } from "../hooks/use-orb-animation";
import { useOrbAnimation } from "../hooks/use-orb-animation";
import { useDragPosition } from "../hooks/use-drag-position";
import { useMouseTracker } from "../hooks/use-mouse-tracker";
import { useAiEyes } from "../provider/AiEyesProvider";
import { OrbDots } from "./OrbDots";
import { HelpBubble } from "./HelpBubble";
import {
	RadialMoodMenu,
	DEFAULT_RADIAL_ITEMS,
	type RadialMenuItem,
} from "./RadialMoodMenu";

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
	onMenuAction?: (actionId: string) => void;
	menuItems?: RadialMenuItem[];
	mood?: OrbMood;
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
	onMenuAction,
	menuItems = DEFAULT_RADIAL_ITEMS,
	mood: externalMood,
	disabled,
	className,
	style,
	locale,
}: AiEyesProps) {
	const {
		mood: ctxMood,
		activeSuggestion,
		setActiveSuggestion,
		setMood,
		enabled,
		setEnabled,
		setPanelOpen,
		setPanelPrefill,
		collector,
	} = useAiEyes();
	const effectiveMood = externalMood ?? (ctxMood as OrbMood);

	const containerRef = useRef<HTMLDivElement>(null);
	const [isHovered, setIsHovered] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [previewMood, setPreviewMood] = useState<OrbMood | null>(null);
	const [actionMood, setActionMood] = useState<OrbMood | null>(null);
	const [cooldown, setCooldown] = useState(false);
	const moodBeforeMenuRef = useRef<OrbMood>("idle");
	const actionTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const cooldownTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const displayMood = actionMood ?? previewMood ?? effectiveMood;
	const interactionLocked = menuOpen || actionMood !== null || cooldown;

	const animation = useOrbAnimation(displayMood);
	const offset = useMouseTracker(containerRef, {
		maxOffset: 4,
		smoothing: 0.3,
		deadZone: 20,
		active: !menuOpen,
	});

	const { position: dragPos, isDragging, hasDragged, handlePointerDown } = useDragPosition(
		draggable && position !== "custom" && !interactionLocked,
		onPositionChange,
	);

	const startCooldown = useCallback((ms: number) => {
		if (cooldownTimerRef.current) {
			clearTimeout(cooldownTimerRef.current);
		}
		setCooldown(true);
		cooldownTimerRef.current = setTimeout(() => setCooldown(false), ms);
	}, []);

	const handleClick = useCallback(() => {
		if (isDragging || disabled || menuOpen) {
			return;
		}
		if (actionTimerRef.current) {
			clearTimeout(actionTimerRef.current);
		}
		setActionMood("wink");
		actionTimerRef.current = setTimeout(() => {
			setActionMood(null);
			startCooldown(600);
		}, 400);
		onClick?.();
	}, [isDragging, disabled, menuOpen, onClick, startCooldown]);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			if (disabled) {
				return;
			}
			moodBeforeMenuRef.current = effectiveMood;
			setMenuOpen(true);
		},
		[disabled, effectiveMood],
	);

	const handleMenuClose = useCallback(() => {
		setMenuOpen(false);
		setPreviewMood(null);
		startCooldown(1500);
	}, [startCooldown]);

	const handleMenuSelect = useCallback(
		(item: RadialMenuItem) => {
			setMenuOpen(false);
			setPreviewMood(null);

			if (actionTimerRef.current) {
				clearTimeout(actionTimerRef.current);
			}
			setActionMood(item.mood);
			actionTimerRef.current = setTimeout(() => {
				setActionMood(null);
				startCooldown(1200);
			}, 800);

			if (onMenuAction) {
				onMenuAction(item.id);
				return;
			}

			const ctx = collector.collect();
			const pageTitle = ctx.pageTitle ?? document.title;
			const pageUrl = ctx.route ?? window.location.pathname;

			switch (item.id) {
				case "ask":
					setPanelPrefill("");
					setPanelOpen(true);
					break;
				case "analyze":
					setPanelPrefill(`请帮我分析当前页面的内容：\n📄 ${pageTitle}\n🔗 ${pageUrl}`);
					setPanelOpen(true);
					break;
				case "bookmark": {
					const snapshot = {
						title: pageTitle,
						url: pageUrl,
						time: new Date().toISOString(),
					};
					try {
						const stored = JSON.parse(
							localStorage.getItem("ai-eyes-bookmarks") ?? "[]",
						) as unknown[];
						stored.push(snapshot);
						localStorage.setItem(
							"ai-eyes-bookmarks",
							JSON.stringify(stored),
						);
					} catch {
						/* noop */
					}
					break;
				}
				case "history":
					setPanelPrefill("请显示我最近的操作记录摘要");
					setPanelOpen(true);
					break;
				case "share": {
					const shareText = `📄 ${pageTitle}\n🔗 ${pageUrl}`;
					if (navigator.clipboard) {
						navigator.clipboard.writeText(shareText).catch(() => {});
					}
					break;
				}
				case "feedback":
					setPanelPrefill("我想反馈一个问题：");
					setPanelOpen(true);
					break;
				case "pause":
					setEnabled(!enabled);
					break;
				case "settings":
					setPanelPrefill("/settings");
					setPanelOpen(true);
					break;
				default:
					break;
			}
		},
		[onMenuAction, collector, setPanelOpen, setPanelPrefill, enabled, setEnabled, startCooldown],
	);

	const handleMenuHover = useCallback((item: RadialMenuItem | null) => {
		setPreviewMood(item?.mood ?? null);
	}, []);

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
			: hasDragged
				? { position: "fixed", left: dragPos.x, top: dragPos.y, zIndex: 9999 }
				: position === "bottom-right"
					? { position: "fixed", right: 24, bottom: 24, zIndex: 9999 }
					: { position: "fixed", left: 24, bottom: 24, zIndex: 9999 };

	return (
		<div
			ref={containerRef}
			className={className}
			style={{
				...positionStyle,
				width: size,
				height: size,
				position: positionStyle.position ?? "relative",
				...style,
			}}
		>
			<button
				type="button"
				style={{
					width: size,
					height: size,
					cursor: isDragging ? "grabbing" : "pointer",
					userSelect: "none",
					touchAction: "none",
					background: "none",
					border: "none",
					padding: 0,
					outline: "none",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					position: "relative",
					zIndex: menuOpen ? 10001 : 1,
				}}
				onPointerDown={menuOpen ? undefined : handlePointerDown}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				aria-label="AI Assistant"
			>
				<OrbDots
					size={size}
					offsetX={offset.x}
					offsetY={offset.y}
					eyeState={animation.eyeState}
					leftEyeR={animation.leftEyeR}
					rightEyeR={animation.rightEyeR}
					leftBreathe={animation.leftBreathe}
					rightBreathe={animation.rightBreathe}
					brightness={animation.brightness}
					glowIntensity={animation.glowIntensity}
					mood={animation.mood}
					isHovered={isHovered}
				/>
			</button>

			{activeSuggestion && !menuOpen && (
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

			<RadialMoodMenu
				open={menuOpen}
				onClose={handleMenuClose}
				onSelect={handleMenuSelect}
				onHover={handleMenuHover}
				items={menuItems}
				anchorSize={size}
			/>
		</div>
	);
}
