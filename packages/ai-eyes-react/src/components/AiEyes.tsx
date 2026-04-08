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
	const [showDiscoveryHint, setShowDiscoveryHint] = useState(false);
	const moodBeforeMenuRef = useRef<OrbMood>("idle");
	const actionTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const cooldownTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const longPressTriggeredRef = useRef(false);

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

	const openMenu = useCallback(() => {
		if (disabled) {
			return;
		}
		moodBeforeMenuRef.current = effectiveMood;
		setMenuOpen(true);
		setShowDiscoveryHint(false);
		try {
			sessionStorage.setItem("ai-eyes-menu-discovered", "1");
		} catch { /* noop */ }
	}, [disabled, effectiveMood]);

	const handleClick = useCallback(() => {
		if (isDragging || disabled || menuOpen || longPressTriggeredRef.current) {
			longPressTriggeredRef.current = false;
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
			openMenu();
		},
		[openMenu],
	);

	const handlePointerDownForLongPress = useCallback(
		(_e: React.PointerEvent) => {
			if (menuOpen || disabled) {
				return;
			}
			longPressTriggeredRef.current = false;
			longPressTimerRef.current = setTimeout(() => {
				longPressTriggeredRef.current = true;
				openMenu();
			}, 500);
		},
		[menuOpen, disabled, openMenu],
	);

	const handlePointerUpForLongPress = useCallback(() => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = undefined;
		}
	}, []);

	// Show discovery hint on first hover if menu hasn't been used
	const handleMouseEnterWithHint = useCallback(() => {
		setIsHovered(true);
		if (menuOpen || activeSuggestion) {
			return;
		}
		try {
			if (!sessionStorage.getItem("ai-eyes-menu-discovered")) {
				setShowDiscoveryHint(true);
			}
		} catch { /* noop */ }
	}, [menuOpen, activeSuggestion]);

	const handleMouseLeaveWithHint = useCallback(() => {
		setIsHovered(false);
		setShowDiscoveryHint(false);
	}, []);

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
				onPointerDown={(e) => {
					if (!menuOpen) {
						handlePointerDown(e);
						handlePointerDownForLongPress(e);
					}
				}}
				onPointerUp={handlePointerUpForLongPress}
				onPointerCancel={handlePointerUpForLongPress}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onMouseEnter={handleMouseEnterWithHint}
				onMouseLeave={handleMouseLeaveWithHint}
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

			{showDiscoveryHint && !activeSuggestion && !menuOpen && (
				<div
					style={{
						position: "absolute",
						bottom: "calc(100% + 8px)",
						right: 0,
						whiteSpace: "nowrap",
						background: "var(--ai-eyes-bubble-bg, hsl(var(--card, 0 0% 100%)))",
						color: "var(--ai-eyes-bubble-fg, hsl(var(--card-foreground, 0 0% 9%)))",
						border: "1px solid var(--ai-eyes-bubble-border, hsl(var(--border, 0 0% 90%)))",
						borderRadius: 10,
						padding: "6px 12px",
						fontSize: 11,
						boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)",
						pointerEvents: "none",
						opacity: 0.9,
					}}
				>
					💡 长按或右键查看更多
				</div>
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
