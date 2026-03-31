"use client";

import { cn } from "@repo/ui";
import { AgentFloatingButton } from "@flowmail/components/AgentFloatingButton";
import { AgentProvider } from "@flowmail/components/AgentProvider";
import { NavBar } from "@saas/shared/components/NavBar";
import type { PropsWithChildren } from "react";
import { config } from "@/config";
import { SidebarProvider, useSidebar } from "../lib/sidebar-context";

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
		</div>
	);
}

export function AppWrapper({ children }: PropsWithChildren) {
	return (
		<SidebarProvider>
			<AgentProvider>
				<AppContent>{children}</AppContent>
			</AgentProvider>
		</SidebarProvider>
	);
}
