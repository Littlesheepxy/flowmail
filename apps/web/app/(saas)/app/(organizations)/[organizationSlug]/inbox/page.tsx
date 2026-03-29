import { PageHeader } from "@saas/shared/components/PageHeader";
import { EntityList } from "@flowmail/components/EntityList";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
	return (
		<div>
			<PageHeader
				title="Inbox"
				subtitle="All business items extracted from your emails"
			/>
			<EntityList
				title="All Items"
				emptyMessage="No items yet. Connect an email account to start processing."
			/>
		</div>
	);
}
