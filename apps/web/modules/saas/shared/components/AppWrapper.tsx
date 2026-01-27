import { config } from "@repo/config";
import { NavBar } from "@saas/shared/components/NavBar";
import { cn } from "@ui/lib";
import type { PropsWithChildren } from "react";

export function AppWrapper({ children }: PropsWithChildren) {
	return (
		<div>
			<NavBar />
			<div
				className={cn("md:pr-4 py-4 flex", [
					config.ui.saas.useSidebarLayout
						? "min-h-[calc(100vh)] md:ml-[280px]"
						: "",
				])}
			>
				<main
					className={cn(
						"py-6 rounded-3xl bg-card px-4 md:p-8 min-h-full w-full",
					)}
				>
					<div className="container px-0">{children}</div>
				</main>
			</div>
		</div>
	);
}
