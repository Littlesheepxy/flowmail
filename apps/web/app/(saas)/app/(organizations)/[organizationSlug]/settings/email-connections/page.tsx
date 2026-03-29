import { PageHeader } from "@saas/shared/components/PageHeader";
import { EmailConnectionsList } from "@flowmail/components/EmailConnectionsList";

export const metadata = { title: "Email Connections" };

export default function EmailConnectionsPage() {
	return (
		<div>
			<PageHeader
				title="Email Connections"
				subtitle="Manage connected email accounts for automatic processing"
			/>
			<EmailConnectionsList />
		</div>
	);
}
