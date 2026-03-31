"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import type { ReactNode } from "react";

type ValueFormat = "number" | "currency" | "percentage";

interface StatsTileProps {
	title: string;
	value: number;
	valueFormat?: ValueFormat;
	trend?: number;
	children?: ReactNode;
}

function formatValue(value: number, format: ValueFormat): string {
	switch (format) {
		case "currency":
			return `$${Intl.NumberFormat("en-US").format(value)}`;
		case "percentage":
			return `${(value * 100).toFixed(1)}%`;
		default:
			return Intl.NumberFormat("en-US").format(value);
	}
}

export function StatsTile({
	title,
	value,
	valueFormat = "number",
	trend,
	children,
}: StatsTileProps) {
	const isPositive = trend !== undefined && trend >= 0;
	const trendLabel =
		trend !== undefined
			? `${isPositive ? "+" : ""}${(trend * 100).toFixed(0)}%`
			: null;

	return (
		<Card className="overflow-hidden">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium text-foreground/60">
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent className="pb-0">
				<div className="flex items-end justify-between gap-2 pb-3">
					<span className="text-2xl font-semibold tabular-nums">
						{formatValue(value, valueFormat)}
					</span>
					{trendLabel && (
						<span
							className={`flex items-center gap-0.5 text-xs font-medium ${
								isPositive ? "text-emerald-600" : "text-rose-500"
							}`}
						>
							{isPositive ? (
								<TrendingUpIcon className="size-3.5" />
							) : (
								<TrendingDownIcon className="size-3.5" />
							)}
							{trendLabel}
						</span>
					)}
				</div>
				{children && <div className="h-20 w-full">{children}</div>}
			</CardContent>
		</Card>
	);
}
