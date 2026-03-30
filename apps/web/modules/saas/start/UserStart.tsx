"use client";

import { Card } from "@repo/ui/components/card";
import type { ChartConfig } from "@repo/ui/components/chart";
import { StatsTile } from "./components/StatsTile";
import { StatsTileChart } from "./components/StatsTileChart";

const emailsData = [
	{ month: "Jan", emails: 120 },
	{ month: "Feb", emails: 145 },
	{ month: "Mar", emails: 132 },
	{ month: "Apr", emails: 178 },
	{ month: "May", emails: 203 },
];

const approvalsData = [
	{ month: "Jan", approvals: 14 },
	{ month: "Feb", approvals: 18 },
	{ month: "Mar", approvals: 22 },
	{ month: "Apr", approvals: 19 },
	{ month: "May", approvals: 31 },
];

const timeSavedData = [
	{ month: "Jan", hours: 3.2 },
	{ month: "Feb", hours: 4.1 },
	{ month: "Mar", hours: 5.8 },
	{ month: "Apr", hours: 6.4 },
	{ month: "May", hours: 7.2 },
];

const emailsChartConfig = {
	emails: { label: "Emails Processed", color: "#6366f1" },
} satisfies ChartConfig;

const approvalsChartConfig = {
	approvals: { label: "Approvals", color: "#22c55e" },
} satisfies ChartConfig;

const timeSavedChartConfig = {
	hours: { label: "Hours Saved", color: "#f59e0b" },
} satisfies ChartConfig;

export default function UserStart() {
	return (
		<div className="@container">
			<div className="grid @2xl:grid-cols-3 gap-4">
				<StatsTile
					title="Emails Processed"
					value={203}
					valueFormat="number"
					trend={0.14}
				>
					<StatsTileChart
						data={emailsData}
						dataKey="emails"
						chartConfig={emailsChartConfig}
						gradientId="gradientEmails"
						tooltipFormatter={(value) =>
							Intl.NumberFormat("en-US").format(Number(value))
						}
					/>
				</StatsTile>
				<StatsTile
					title="Approvals Handled"
					value={31}
					valueFormat="number"
					trend={0.63}
				>
					<StatsTileChart
						data={approvalsData}
						dataKey="approvals"
						chartConfig={approvalsChartConfig}
						gradientId="gradientApprovals"
						tooltipFormatter={(value) => String(value)}
					/>
				</StatsTile>
				<StatsTile
					title="Hours Saved"
					value={7.2}
					valueFormat="number"
					trend={0.125}
				>
					<StatsTileChart
						data={timeSavedData}
						dataKey="hours"
						chartConfig={timeSavedChartConfig}
						gradientId="gradientHours"
						tooltipFormatter={(value) => `${value}h`}
					/>
				</StatsTile>
			</div>

			<Card className="mt-6">
				<div className="flex h-40 items-center justify-center p-8 text-foreground/50 text-sm">
					Connect your first mailbox to start processing emails automatically.
				</div>
			</Card>
		</div>
	);
}
