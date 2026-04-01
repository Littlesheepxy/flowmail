"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSidebar } from "@saas/shared/lib/sidebar-context";
import {
	SearchIcon,
	SparklesIcon,
	SlidersHorizontalIcon,
} from "lucide-react";
import { cn } from "@repo/ui";
import { EntityCardList } from "./EntityCardList";
import { ThreadChatView } from "./ThreadChatView";
import { AgentPanel } from "./AgentPanel";

function useIsWideScreen() {
	const [isWide, setIsWide] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 1440px)");
		setIsWide(mq.matches);
		const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);
	return isWide;
}

const AGENT_MIN_W = 340;
const AGENT_MAX_W = 600;
const AGENT_DEFAULT_W = 380;

export function SmartInbox() {
	const { isCollapsed } = useSidebar();
	const isWide = useIsWideScreen();
	const searchParams = useSearchParams();
	const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
		null,
	);
	const [agentManualToggle, setAgentManualToggle] = useState<boolean | null>(null);
	const [search, setSearch] = useState("");
	const [agentWidth, setAgentWidth] = useState(AGENT_DEFAULT_W);
	const isDragging = useRef(false);
	const startX = useRef(0);
	const startW = useRef(AGENT_DEFAULT_W);

	const agentOpen = agentManualToggle ?? (isWide || isCollapsed);

	const handleResizeStart = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			isDragging.current = true;
			startX.current = e.clientX;
			startW.current = agentWidth;
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";

			const onMove = (ev: MouseEvent) => {
				if (!isDragging.current) {
					return;
				}
				const delta = startX.current - ev.clientX;
				const next = Math.min(AGENT_MAX_W, Math.max(AGENT_MIN_W, startW.current + delta));
				setAgentWidth(next);
			};
			const onUp = () => {
				isDragging.current = false;
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				document.removeEventListener("mousemove", onMove);
				document.removeEventListener("mouseup", onUp);
			};
			document.addEventListener("mousemove", onMove);
			document.addEventListener("mouseup", onUp);
		},
		[agentWidth],
	);

	const categorySlug = searchParams.get("category") ?? undefined;

	return (
		<div
			className="flex flex-col h-dvh overflow-hidden fixed inset-0 z-10 bg-muted/40 transition-[left] duration-300 ease-in-out"
			style={{ left: isCollapsed ? 64 : 260 }}
		>
			{/* Global top bar — outside content card */}
			<div className="flex items-center gap-3 px-4 py-2 shrink-0">
				{/* Search */}
				<div className="relative flex-1 max-w-md">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
					<input
						type="text"
						placeholder="搜索邮件、审批、汇报..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full rounded-full bg-background/80 py-1.5 pl-9 pr-4 text-sm outline-none border border-border/50 focus:bg-background focus:border-border focus:ring-1 focus:ring-primary/20 transition-colors"
					/>
				</div>

				<div className="flex items-center gap-1 ml-auto">
					<button
						type="button"
						className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-background/60 transition-colors"
					>
						<SlidersHorizontalIcon className="size-3.5" />
						<span className="hidden sm:inline">筛选</span>
					</button>

					<button
						type="button"
						onClick={() => setAgentManualToggle((prev) => !(prev ?? agentOpen))}
						className={cn(
							"flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
							agentOpen
								? "bg-background text-primary shadow-sm"
								: "text-muted-foreground hover:bg-background/60",
						)}
					>
						<SparklesIcon className="size-3.5" />
						<span className="hidden sm:inline">AI Agent</span>
					</button>
				</div>
			</div>

			{/* Content area card */}
			<div className="flex-1 flex overflow-hidden min-w-0 mx-2 mb-2">
				<div className="flex-1 flex overflow-hidden bg-background rounded-2xl border shadow-sm">
					{/* Entity list panel */}
					<div className="w-[300px] shrink-0 flex flex-col overflow-hidden">
						<EntityCardList
							selectedEntityId={selectedEntityId}
							onSelectEntity={setSelectedEntityId}
							categorySlug={categorySlug}
							search={search}
						/>
					</div>

					{/* Thread view */}
					<div className="flex-1 flex flex-col overflow-hidden min-w-0 border-l">
						<ThreadChatView entityId={selectedEntityId} />
					</div>
				</div>

				{/* Agent panel — always mounted to avoid Radix id hydration mismatch */}
				<div
					className={cn(
						"shrink-0 flex overflow-hidden transition-[width] duration-200",
						!agentOpen && "hidden",
					)}
					style={{ width: agentOpen ? agentWidth : 0 }}
				>
					{/* Drag handle */}
					{/* biome-ignore lint/a11y/useSemanticElements: drag handle is not a true separator */}
					<div
						role="separator"
						tabIndex={0}
						aria-orientation="vertical"
						aria-valuenow={agentWidth}
						aria-valuemin={AGENT_MIN_W}
						aria-valuemax={AGENT_MAX_W}
						className="w-2 shrink-0 cursor-col-resize flex items-center justify-center group"
						onMouseDown={handleResizeStart}
					>
						<div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-foreground/30 group-active:bg-foreground/50 transition-colors" />
					</div>
					<div className="flex-1 flex flex-col overflow-hidden min-w-0">
						<AgentPanel
							entityId={selectedEntityId}
							onClose={() => setAgentManualToggle(false)}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
