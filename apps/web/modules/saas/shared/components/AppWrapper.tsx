"use client";

import { cn } from "@repo/ui";
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
				className={cn("flex", {
					"min-h-[calc(100vh)] md:ml-[280px]":
						useSidebarLayout && !isCollapsed,
					"min-h-[calc(100vh)] md:ml-[80px]":
						useSidebarLayout && isCollapsed,
				})}
			>
				<main
					className={cn(
						"py-6 bg-card px-4 md:p-8 min-h-full w-full border-t md:border-t-0 md:border-l",
					)}
				>
					<div className="container px-0 h-full">{children}</div>
				</main>
			</div>
		</div>
	);
}

export function AppWrapper({ children }: PropsWithChildren) {
	return (
		<SidebarProvider>
			<AppContent>{children}</AppContent>
		</SidebarProvider>
	);
}
