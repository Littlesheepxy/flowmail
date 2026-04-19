"use client";

import { Card } from "@repo/ui/components/card";
import { cn } from "@repo/ui";
import {
	InfoIcon,
	CheckCircle2Icon,
	AlertTriangleIcon,
	AlertOctagonIcon,
	type LucideIcon,
} from "lucide-react";
import type { SummaryBlock as Spec } from "@repo/api";

const TONE: Record<NonNullable<Spec["tone"]>, { bg: string; border: string; icon: LucideIcon; iconColor: string }> = {
	info: { bg: "bg-blue-50/50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-900", icon: InfoIcon, iconColor: "text-blue-500" },
	success: { bg: "bg-emerald-50/50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-900", icon: CheckCircle2Icon, iconColor: "text-emerald-500" },
	warning: { bg: "bg-amber-50/50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-900", icon: AlertTriangleIcon, iconColor: "text-amber-500" },
	danger: { bg: "bg-red-50/50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-900", icon: AlertOctagonIcon, iconColor: "text-red-500" },
	neutral: { bg: "", border: "", icon: InfoIcon, iconColor: "text-muted-foreground" },
};

export function SummaryBlock({ block }: { block: Spec }) {
	const tone = block.tone ?? "neutral";
	const cfg = TONE[tone];
	const Icon = cfg.icon;

	return (
		<Card className={cn("p-4", cfg.bg, cfg.border, tone !== "neutral" && "border")}>
			{block.title && (
				<div className="mb-2 flex items-center gap-2 text-sm font-semibold">
					<Icon className={cn("size-4 shrink-0", cfg.iconColor)} />
					{block.title}
				</div>
			)}
			<div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
				{block.text}
			</div>
		</Card>
	);
}
