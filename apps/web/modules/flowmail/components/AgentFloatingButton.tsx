"use client";

import { cn } from "@repo/ui";
import { SparklesIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAgent } from "./AgentProvider";
import { AgentPanel } from "./AgentPanel";

export function AgentFloatingButton() {
	const pathname = usePathname();
	const { isFloatingOpen, toggleFloating } = useAgent();

	const isInboxPage = pathname.includes("/inbox");
	if (isInboxPage) {
		return null;
	}

	return (
		<>
			{/* Floating panel */}
			{isFloatingOpen && (
				<div className="fixed bottom-20 right-6 z-50 w-[360px] h-[520px] rounded-xl border shadow-2xl bg-background overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
					<AgentPanel entityId={null} />
				</div>
			)}

			{/* FAB */}
			<button
				type="button"
				onClick={toggleFloating}
				className={cn(
					"fixed bottom-6 right-6 z-50 flex items-center justify-center size-12 rounded-full shadow-lg transition-all",
					isFloatingOpen
						? "bg-muted hover:bg-muted/80"
						: "bg-primary text-primary-foreground hover:bg-primary/90",
				)}
			>
				{isFloatingOpen ? (
					<XIcon className="size-5" />
				) : (
					<SparklesIcon className="size-5" />
				)}
			</button>
		</>
	);
}
