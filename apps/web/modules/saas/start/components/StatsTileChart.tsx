"use client";

import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@repo/ui/components/chart";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface StatsTileChartProps {
	data: Record<string, unknown>[];
	dataKey: string;
	chartConfig: ChartConfig;
	gradientId: string;
	tooltipFormatter?: (value: unknown) => string;
}

export function StatsTileChart({
	data,
	dataKey,
	chartConfig,
	gradientId,
	tooltipFormatter,
}: StatsTileChartProps) {
	const color = (chartConfig[dataKey]?.color as string) ?? "var(--color-primary)";

	return (
		<ChartContainer config={chartConfig} className="h-full w-full">
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
					<defs>
						<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
							<stop offset="5%" stopColor={color} stopOpacity={0.3} />
							<stop offset="95%" stopColor={color} stopOpacity={0} />
						</linearGradient>
					</defs>
					<ChartTooltip
						content={
							<ChartTooltipContent
								formatter={
									tooltipFormatter
										? (value) => [tooltipFormatter(value), ""]
										: undefined
								}
								hideLabel
							/>
						}
					/>
					<Area
						type="monotone"
						dataKey={dataKey}
						stroke={color}
						strokeWidth={1.5}
						fill={`url(#${gradientId})`}
						dot={false}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</ChartContainer>
	);
}
