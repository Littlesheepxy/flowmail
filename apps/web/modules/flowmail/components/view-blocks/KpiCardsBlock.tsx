"use client";

import { Card } from "@repo/ui/components/card";
import { cn } from "@repo/ui";
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import type { KpiCardsBlock as Spec } from "@repo/api";

const TONE: Record<string, string> = {
	info: "text-blue-600 dark:text-blue-400",
	success: "text-emerald-600 dark:text-emerald-400",
	warning: "text-amber-600 dark:text-amber-400",
	danger: "text-red-600 dark:text-red-400",
	neutral: "text-foreground",
};

function parseDelta(delta?: string): { value: string; positive?: boolean } {
	if (!delta) {
		return { value: "" };
	}
	const trimmed = delta.trim();
	if (trimmed.startsWith("+") || trimmed.startsWith("↑")) {
		return { value: trimmed, positive: true };
	}
	if (trimmed.startsWith("-") || trimmed.startsWith("↓")) {
		return { value: trimmed, positive: false };
	}
	return { value: trimmed };
}

export function KpiCardsBlock({ block }: { block: Spec }) {
	const cols = Math.min(block.items.length, 4);
	return (
		<div className="space-y-2">
			{block.title && (
				<h4 className="text-sm font-semibold text-foreground/80">{block.title}</h4>
			)}
			<div
				className={cn(
					"grid gap-2",
					cols === 1 && "grid-cols-1",
					cols === 2 && "grid-cols-2",
					cols === 3 && "grid-cols-3",
					cols >= 4 && "grid-cols-2 sm:grid-cols-4",
				)}
			>
				{block.items.map((item, i) => {
					const tone = item.tone ?? "neutral";
					const delta = parseDelta(item.delta);
					return (
						<Card key={`${item.label}-${i}`} className="p-3">
							<p className="text-xs text-muted-foreground truncate" title={item.label}>
								{item.label}
							</p>
							<div className="mt-1 flex items-baseline gap-1.5">
								<span className={cn("text-xl font-bold tabular-nums", TONE[tone])}>
									{item.value}
								</span>
								{delta.value && (
									<span
										className={cn(
											"inline-flex items-center gap-0.5 text-xs font-medium",
											delta.positive === true && "text-emerald-600 dark:text-emerald-400",
											delta.positive === false && "text-red-500 dark:text-red-400",
											delta.positive === undefined && "text-muted-foreground",
										)}
									>
										{delta.positive === true && <TrendingUpIcon className="size-3" />}
										{delta.positive === false && <TrendingDownIcon className="size-3" />}
										{delta.value}
									</span>
								)}
							</div>
							{item.hint && (
								<p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{item.hint}</p>
							)}
						</Card>
					);
				})}
			</div>
		</div>
	);
}
