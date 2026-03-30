"use client";

import { useState } from "react";
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

export function SmartInbox() {
	const { isCollapsed } = useSidebar();
	const searchParams = useSearchParams();
	const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
		null,
	);
	const [agentOpen, setAgentOpen] = useState(false);
	const [search, setSearch] = useState("");

	const categorySlug = searchParams.get("category") ?? undefined;

	return (
		<div
			className="flex h-dvh overflow-hidden fixed inset-0 z-10 bg-muted/40 transition-[left] duration-300 ease-in-out p-2"
			style={{ left: isCollapsed ? 64 : 260 }}
		>
			{/* One big rounded card for the entire right area */}
			<div className="flex-1 flex flex-col overflow-hidden bg-background rounded-2xl border shadow-sm">
				{/* Global Header */}
				<div className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0">
					{/* Search */}
					<div className="relative flex-1 max-w-md">
						<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
						<input
							type="text"
							placeholder="搜索邮件、审批、汇报..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-full rounded-lg bg-muted/50 py-1.5 pl-9 pr-3 text-sm outline-none border-none focus:bg-muted/80 focus:ring-1 focus:ring-primary/30 transition-colors"
						/>
					</div>

					<div className="flex items-center gap-1 ml-auto">
						{/* Filter button placeholder */}
						<button
							type="button"
							className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 transition-colors"
						>
							<SlidersHorizontalIcon className="size-3.5" />
							<span className="hidden sm:inline">筛选</span>
						</button>

						{/* AI Agent toggle */}
						<button
							type="button"
							onClick={() => setAgentOpen(!agentOpen)}
							className={cn(
								"flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
								agentOpen
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:bg-muted/60",
							)}
						>
							<SparklesIcon className="size-3.5" />
							<span className="hidden sm:inline">
								AI Agent
							</span>
						</button>
					</div>
				</div>

				{/* Content area */}
				<div className="flex-1 flex overflow-hidden min-w-0">
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

				{/* Agent panel */}
				{agentOpen && (
					<div className="w-[340px] shrink-0 flex flex-col overflow-hidden border-l">
							<AgentPanel
								entityId={selectedEntityId}
								onClose={() => setAgentOpen(false)}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
