"use client";

import { cn } from "@repo/ui";
import { AiEyesProvider } from "@ai-eyes/react";
import { AnalyzerEngine, createVercelAiAdapter } from "@ai-eyes/ai";
import type { AiEyesCoreConfig, ConfusionEvent, HelpSuggestion } from "@ai-eyes/core";
import { AgentFloatingButton } from "@flowmail/components/AgentFloatingButton";
import { AgentProvider } from "@flowmail/components/AgentProvider";
import { ProactiveHintWatcher } from "@flowmail/components/ProactiveHintWatcher";
import { NavBar } from "@saas/shared/components/NavBar";
import { useCallback, type PropsWithChildren } from "react";
import { config } from "@/config";
import { SidebarProvider, useSidebar } from "../lib/sidebar-context";

const analyzer = new AnalyzerEngine({
	adapter: createVercelAiAdapter({ apiUrl: "/api/ai-eyes/analyze" }),
	cooldownMs: 15000,
});

const AI_EYES_CONFIG: AiEyesCoreConfig = {
	recorder: {
		durationMs: 30_000,
		maxEntries: 200,
		trackNavigation: true,
		trackFocus: true,
		trackKeyboard: true,
		trackErrors: true,
	},
};

function AppContent({ children }: PropsWithChildren) {
	const { isCollapsed } = useSidebar();
	const { useSidebarLayout } = config.saas;

	return (
		<div className="bg-background">
			<NavBar />
			<div
				className={cn("flex transition-[margin] duration-300 ease-in-out", {
				"min-h-[calc(100vh)] md:ml-[260px]":
					useSidebarLayout && !isCollapsed,
				"min-h-[calc(100vh)] md:ml-[64px]":
					useSidebarLayout && isCollapsed,
				})}
			>
				<main
					className={cn(
						"py-6 bg-card px-4 md:p-8 min-h-full w-full border-t md:border-t-0",
					)}
				>
					<div className="container px-0 h-full">{children}</div>
				</main>
			</div>
			<AgentFloatingButton />
			<ProactiveHintWatcher />
		</div>
	);
}

export function AppWrapper({ children }: PropsWithChildren) {
	const handleConfusion = useCallback(
		async (event: ConfusionEvent): Promise<HelpSuggestion | null> => {
			return analyzer.analyze(event);
		},
		[],
	);

	return (
		<SidebarProvider>
			<AgentProvider>
				<AiEyesProvider config={AI_EYES_CONFIG} onConfusion={handleConfusion}>
					<AppContent>{children}</AppContent>
				</AiEyesProvider>
			</AgentProvider>
		</SidebarProvider>
	);
}
