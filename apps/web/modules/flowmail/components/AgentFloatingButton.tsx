"use client";

import type { HelpSuggestion } from "@ai-eyes/core";
import type { AiEyesPosition } from "@ai-eyes/react";
import { AiEyes, useAiEyes } from "@ai-eyes/react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentPanel } from "./AgentPanel";
import { useAgent } from "./AgentProvider";

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
	const t = useTranslations();
	const pathname = usePathname();
	const { isFloatingOpen, toggleFloating, setIsFloatingOpen } = useAgent();
	const { setMood } = useAiEyes();

	const [eyePos, setEyePos] = useState<AiEyesPosition>({ x: 0, y: 0 });
	const panelRef = useRef<HTMLDivElement>(null);
	const eyeRef = useRef<HTMLDivElement>(null);

	const handleHelpAccepted = useCallback(
		(_suggestion: HelpSuggestion) => {
			setMood("happy");
			setIsFloatingOpen(true);
		},
		[setMood, setIsFloatingOpen],
	);

	const handleClick = useCallback(() => {
		toggleFloating();
	}, [toggleFloating]);

	const handlePositionChange = useCallback((pos: AiEyesPosition) => {
		setEyePos(pos);
	}, []);

	useEffect(() => {
		if (!isFloatingOpen) {
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
					<AgentPanel entityId={null} />
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
						onHelpAccepted={handleHelpAccepted}
						onPositionChange={handlePositionChange}
						mood={isFloatingOpen ? "happy" : undefined}
						locale={{
							helpAccept: t("aiEyes.helpAccept"),
							helpDismiss: t("aiEyes.helpDismiss"),
						}}
						style={{ color: "var(--foreground)" }}
					/>
				</div>
			)}
		</>
	);
}
