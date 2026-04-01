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
				<div className="fixed bottom-20 right-6 z-50 w-[360px] h-[520px] shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200">
					<AgentPanel entityId={null} />
				</div>
			)}

			{/* FAB */}
			<button
				type="button"
				onClick={toggleFloating}
				className={cn(
					"fixed bottom-6 right-6 z-50 flex items-center justify-center size-12 rounded-2xl transition-all agent-fab-ring",
					isFloatingOpen
						? "bg-muted hover:bg-muted/80 text-foreground"
						: "bg-foreground text-background hover:opacity-85",
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
