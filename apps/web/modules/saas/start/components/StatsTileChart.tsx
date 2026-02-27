"use client";

import { cn } from "@repo/ui";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@repo/ui/components/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

interface StatsTileChartProps {
	data: Array<{ month: string; [key: string]: string | number }>;
	dataKey: string;
	chartConfig: ChartConfig;
	gradientId: string;
	tooltipFormatter: (value: number | string) => React.ReactNode;
	className?: string;
}

export function StatsTileChart({
	data,
	dataKey,
	chartConfig,
	gradientId,
	tooltipFormatter,
	className,
}: StatsTileChartProps) {
	return (
		<ChartContainer
			config={chartConfig}
			className={cn("h-32 w-full", className)}
		>
			<AreaChart
				accessibilityLayer
				data={data}
				margin={{ top: 0, right: 5, left: 5, bottom: 20 }}
			>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="0%"
							stopColor={`var(--color-${dataKey})`}
							stopOpacity={0.4}
						/>
						<stop
							offset="100%"
							stopColor={`var(--color-${dataKey})`}
							stopOpacity={0}
						/>
					</linearGradient>
				</defs>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="month"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
				/>
				<ChartTooltip
					content={
						<ChartTooltipContent formatter={tooltipFormatter} />
					}
				/>
				<Area
					dataKey={dataKey}
					type="natural"
					fill={`url(#${gradientId})`}
					stroke={`var(--color-${dataKey})`}
					strokeWidth={2}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
