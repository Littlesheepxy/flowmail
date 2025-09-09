"use client";
import { StatsTile } from "@saas/start/components/StatsTile";
import { Card } from "@ui/components/card";

export default function OrganizationStart() {
	return (
		<div className="@container">
			<div className="grid @2xl:grid-cols-3 gap-4">
				<StatsTile
					title="New clients"
					value={344}
					valueFormat="number"
					trend={0.12}
				/>
				<StatsTile
					title="Revenue"
					value={5243}
					valueFormat="currency"
					trend={0.6}
				/>
				<StatsTile
					title="Churn"
					value={0.03}
					valueFormat="percentage"
					trend={-0.3}
				/>
			</div>

			<Card className="mt-6">
				<div className="flex h-64 items-center justify-center p-8 text-foreground/60">
					Place your content here...
				</div>
			</Card>
		</div>
	);
}
