import { PageHeader } from "@saas/shared/components/PageHeader";
import { PendingApprovalsList } from "@flowmail/components/ApprovalActions";

export const metadata = { title: "Approvals" };

export default function ApprovalsPage() {
	return (
		<div>
			<PageHeader
				title="Approvals"
				subtitle="Review and act on pending approval requests"
			/>
			<PendingApprovalsList />
		</div>
	);
}
