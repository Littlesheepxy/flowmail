"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useSidebar } from "@saas/shared/lib/sidebar-context";
import {
	CheckIcon,
	SearchIcon,
	SparklesIcon,
	SlidersHorizontalIcon,
	XIcon,
} from "lucide-react";
import { cn } from "@repo/ui";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { EntityCardList } from "./EntityCardList";
import { ThreadChatView } from "./ThreadChatView";
import { AgentPanel } from "./AgentPanel";
import { usePageGuide } from "../hooks/use-page-guide";

const FILTER_CATEGORIES = [
	{ value: "approval", label: "审批", color: "#3b82f6" },
	{ value: "report", label: "汇报", color: "#10b981" },
	{ value: "issue", label: "问题", color: "#ef4444" },
	{ value: "feedback", label: "反馈", color: "#f59e0b" },
] as const;

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

	usePageGuide("processFirstEmail", [
		{
			element: '[data-guide="inbox-search"]',
			title: "第 1 步：搜索与筛选",
			description:
				"连接邮箱并同步后，AI 处理过的邮件事项会自动出现在下方列表中。\n\n你可以在搜索框中输入关键词快速定位，也可以按分类筛选。如果列表为空，说明还没有同步邮件——请先去「邮箱连接」页面连接并同步邮箱。",
			side: "bottom",
		},
		{
			element: '[data-guide="inbox-entity-list"]',
			title: "第 2 步：查看和处理事项",
			description:
				"这里是 AI 自动从邮件中提取的业务事项列表。每个事项显示：\n\n• 标题和分类标签\n• AI 提取的关键信息（如申请人、截止日期）\n• 当前状态（待审批、进行中等）\n\n点击任意事项可以查看完整时间线、所有关联邮件，以及执行操作（审批/拒绝等）。",
			side: "right",
		},
	]);

	const router = useRouter();
	const pathname = usePathname();
	const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
		null,
	);
	const [agentManualToggle, setAgentManualToggle] = useState<boolean | null>(null);
	const [search, setSearch] = useState("");
	const [filterOpen, setFilterOpen] = useState(false);
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

	const toggleCategory = useCallback(
		(value: string) => {
			const params = new URLSearchParams(searchParams.toString());
			if (categorySlug === value) {
				params.delete("category");
			} else {
				params.set("category", value);
			}
			const qs = params.toString();
			router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
		},
		[categorySlug, searchParams, router, pathname],
	);

	const clearFilter = useCallback(() => {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("category");
		const qs = params.toString();
		router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
		setFilterOpen(false);
	}, [searchParams, router, pathname]);

	return (
		<div
			data-module="inbox"
			className="flex flex-col h-dvh overflow-hidden fixed inset-0 z-10 bg-muted/40 transition-[left] duration-300 ease-in-out"
			style={{ left: isCollapsed ? 64 : 260 }}
		>
			{/* Global top bar — outside content card */}
			<div className="flex items-center gap-3 px-4 py-2 shrink-0">
				{/* Search */}
				<div className="relative flex-1 max-w-md" data-guide="inbox-search">
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
					<Popover open={filterOpen} onOpenChange={setFilterOpen}>
						<div className="flex items-center">
							<PopoverTrigger asChild>
								<button
									type="button"
									className={cn(
										"flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
										categorySlug
											? "bg-primary/10 text-primary rounded-r-none"
											: "text-muted-foreground hover:bg-background/60",
									)}
								>
									<SlidersHorizontalIcon className="size-3.5" />
									<span className="hidden sm:inline">
										{categorySlug
											? FILTER_CATEGORIES.find((c) => c.value === categorySlug)?.label ?? "筛选"
											: "筛选"}
									</span>
								</button>
							</PopoverTrigger>
							{categorySlug && (
								<button
									type="button"
									className="rounded-lg rounded-l-none bg-primary/10 text-primary px-1.5 py-1.5 hover:bg-primary/20 transition-colors"
									onClick={clearFilter}
								>
									<XIcon className="size-3" />
								</button>
							)}
						</div>
						<PopoverContent align="end" className="w-44 p-1.5">
							<p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">按分类筛选</p>
							{FILTER_CATEGORIES.map((cat) => (
								<button
									key={cat.value}
									type="button"
									onClick={() => {
										toggleCategory(cat.value);
										setFilterOpen(false);
									}}
									className={cn(
										"flex items-center gap-2.5 w-full rounded-md px-2 py-1.5 text-xs transition-colors",
										categorySlug === cat.value
											? "bg-primary/10 text-foreground"
											: "text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
								>
									<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
									<span className="flex-1 text-left">{cat.label}</span>
									{categorySlug === cat.value && <CheckIcon className="size-3 text-primary" />}
								</button>
							))}
							{categorySlug && (
								<button
									type="button"
									onClick={clearFilter}
									className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mt-0.5 border-t pt-1.5"
								>
									清除筛选
								</button>
							)}
						</PopoverContent>
					</Popover>

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
					<div className="w-[300px] shrink-0 flex flex-col overflow-hidden bg-muted/30" data-guide="inbox-entity-list">
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
