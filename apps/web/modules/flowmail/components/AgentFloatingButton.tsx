"use client";

import { AiEyes, useAiEyes } from "@ai-eyes/react";
import type { AiEyesPosition } from "@ai-eyes/react";
import type { HelpSuggestion } from "@ai-eyes/core";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAgent } from "./AgentProvider";
import { AgentPanel } from "./AgentPanel";

const PANEL_W = 360;
const PANEL_H = 520;
const PANEL_GAP = 12;
const EYE_SIZE = 48;

function computePanelPosition(eyePos: AiEyesPosition) {
	const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
	const vh = typeof window !== "undefined" ? window.innerHeight : 800;

	const eyeCenterX = eyePos.x + EYE_SIZE / 2;
	const eyeCenterY = eyePos.y + EYE_SIZE / 2;

	const spaceRight = vw - eyePos.x - EYE_SIZE;
	const spaceLeft = eyePos.x;
	const spaceAbove = eyePos.y;

	let left: number;
	let top: number;

	if (spaceAbove >= PANEL_H + PANEL_GAP) {
		top = eyePos.y - PANEL_H - PANEL_GAP;
		left = eyeCenterX - PANEL_W / 2;
	} else if (spaceRight >= PANEL_W + PANEL_GAP) {
		left = eyePos.x + EYE_SIZE + PANEL_GAP;
		top = eyeCenterY - PANEL_H / 2;
	} else if (spaceLeft >= PANEL_W + PANEL_GAP) {
		left = eyePos.x - PANEL_W - PANEL_GAP;
		top = eyeCenterY - PANEL_H / 2;
	} else {
		top = eyePos.y - PANEL_H - PANEL_GAP;
		left = eyeCenterX - PANEL_W / 2;
	}

	left = Math.max(8, Math.min(vw - PANEL_W - 8, left));
	top = Math.max(8, Math.min(vh - PANEL_H - 8, top));

	return { left, top };
}

export function AgentFloatingButton() {
	const pathname = usePathname();
	const { isFloatingOpen, toggleFloating, setIsFloatingOpen } = useAgent();
	const { setMood } = useAiEyes();

	const [eyePos, setEyePos] = useState<AiEyesPosition>({ x: 0, y: 0 });
	const [panelPrefill, setPanelPrefill] = useState("");
	const panelRef = useRef<HTMLDivElement>(null);
	const eyeRef = useRef<HTMLDivElement>(null);

	const openPanelWith = useCallback(
		(message: string) => {
			setPanelPrefill(message);
			setIsFloatingOpen(true);
		},
		[setIsFloatingOpen],
	);

	const handleHelpAccepted = useCallback(
		(suggestion: HelpSuggestion) => {
			setMood("happy");

			switch (suggestion.suggestedAction) {
				case "open-forward-guide":
				case "open-oauth": {
					const connectDialog = document.querySelector('[data-connect-dialog-trigger]') as HTMLButtonElement | null;
					if (connectDialog) {
						connectDialog.click();
					} else {
						openPanelWith(suggestion.message);
					}
					break;
				}
				case "generate-demo": {
					const demoBtn = document.querySelector('[data-demo-dialog-trigger]') as HTMLButtonElement | null;
					if (demoBtn) {
						demoBtn.click();
					} else {
						openPanelWith(suggestion.message);
					}
					break;
				}
				case "guide-click-entity": {
					const firstCard = document.querySelector('[data-entity-card]') as HTMLButtonElement | null;
					if (firstCard) {
						firstCard.style.outline = "2px solid hsl(var(--primary))";
						firstCard.style.outlineOffset = "-2px";
						firstCard.style.transition = "outline 0.3s";
						setTimeout(() => {
							firstCard.style.outline = "none";
						}, 3000);
					}
					break;
				}
				case "guide-tabs": {
					const tabsTrigger = document.querySelector('[data-tab-trigger="todos"]') as HTMLButtonElement | null;
					tabsTrigger?.click();
					break;
				}
				case "open-chat":
					openPanelWith(suggestion.message);
					break;
				default:
					openPanelWith(suggestion.message);
					break;
			}
		},
		[setMood, openPanelWith],
	);

	const handleClick = useCallback(() => {
		toggleFloating();
	}, [toggleFloating]);

	const handleMenuAction = useCallback(
		(actionId: string) => {
			const pageTitle = document.title;
			const pageUrl = window.location.pathname;

			switch (actionId) {
				case "ask":
					openPanelWith("");
					break;
				case "analyze":
					openPanelWith(`请帮我分析当前页面的内容：\n📄 ${pageTitle}\n🔗 ${pageUrl}`);
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
						localStorage.setItem("ai-eyes-bookmarks", JSON.stringify(stored));
					} catch {
						/* noop */
					}
					break;
				}
				case "history":
					openPanelWith("请显示我最近的操作记录摘要");
					break;
				case "share": {
					const shareText = `📄 ${pageTitle}\n🔗 ${pageUrl}`;
					if (navigator.clipboard) {
						navigator.clipboard.writeText(shareText).catch(() => {});
					}
					break;
				}
				case "feedback":
					openPanelWith("我想反馈一个问题：");
					break;
				case "pause":
					break;
				case "settings":
					openPanelWith("/settings");
					break;
				default:
					openPanelWith("");
					break;
			}
		},
		[openPanelWith],
	);

	const handlePositionChange = useCallback((pos: AiEyesPosition) => {
		setEyePos(pos);
	}, []);

	useEffect(() => {
		if (!isFloatingOpen) {
			setPanelPrefill("");
			return;
		}

		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as Node;

			if (panelRef.current?.contains(target)) {
				return;
			}

			const eyeEl = document.querySelector("[data-ai-eyes]");
			if (eyeEl?.contains(target)) {
				return;
			}

			setIsFloatingOpen(false);
		};

		const timer = setTimeout(() => {
			document.addEventListener("pointerdown", handleClickOutside);
		}, 100);

		return () => {
			clearTimeout(timer);
			document.removeEventListener("pointerdown", handleClickOutside);
		};
	}, [isFloatingOpen, setIsFloatingOpen]);

	const isInboxPage = pathname.includes("/inbox");
	const panelPos = computePanelPosition(eyePos);

	return (
		<>
			{/* Floating panel — follows eye position */}
			{isFloatingOpen && !isInboxPage && (
				<div
					ref={panelRef}
					className="fixed z-50 w-[360px] h-[520px] shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200"
					style={{
						left: panelPos.left,
						top: panelPos.top,
					}}
				>
					<AgentPanel entityId={null} initialMessage={panelPrefill || undefined} />
				</div>
			)}

			{/* AI Eyes — draggable to anywhere */}
			{!isInboxPage && (
				<div data-ai-eyes ref={eyeRef}>
					<AiEyes
						size={EYE_SIZE}
						position="bottom-right"
						draggable
						onClick={handleClick}
						onMenuAction={handleMenuAction}
						onHelpAccepted={handleHelpAccepted}
						onPositionChange={handlePositionChange}
						mood={isFloatingOpen ? "happy" : undefined}
						locale={{
							helpAccept: "帮我解决",
							helpDismiss: "不需要",
						}}
						style={{ color: "var(--foreground)" }}
					/>
				</div>
			)}
		</>
	);
}
