import { Card } from "@ui/components/card";
import { cn } from "@ui/lib";
import type { PropsWithChildren, ReactNode } from "react";

export function SettingsItem({
	children,
	title,
	description,
	danger,
}: PropsWithChildren<{
	title: string | ReactNode;
	description?: string | ReactNode;
	danger?: boolean;
}>) {
	return (
		<Card className="@container p-4 rounded-2xl border md:p-6">
			<div className="grid @-xl:grid-cols-[min(100%/3,280px)_auto] grid-cols-1 @xl:gap-8 gap-4">
				<div className="flex shrink-0 flex-col gap-1.5">
					<h3
						className={cn(
							"m-0 font-semibold leading-tight",
							danger && "text-destructive",
						)}
					>
						{title}
					</h3>
					{description && (
						<p className="m-0 text-foreground/60 text-xs">
							{description}
						</p>
					)}
				</div>
				{children}
			</div>
		</Card>
	);
}
