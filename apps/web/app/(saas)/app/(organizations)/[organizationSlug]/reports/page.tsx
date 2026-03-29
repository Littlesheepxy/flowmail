import { PageHeader } from "@saas/shared/components/PageHeader";
import { EntityList } from "@flowmail/components/EntityList";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
	return (
		<div>
			<PageHeader
				title="Reports"
				subtitle="Track progress updates and status reports from your team"
			/>
			<EntityList
				type="REPORT"
				title="Reports"
				emptyMessage="No reports yet. Reports extracted from emails will appear here."
			/>
		</div>
	);
}
