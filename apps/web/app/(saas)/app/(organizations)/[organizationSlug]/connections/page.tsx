import { PageHeader } from "@saas/shared/components/PageHeader";
import { EmailConnectionsList } from "@flowmail/components/EmailConnectionsList";

export const metadata = { title: "Connections" };

export default function ConnectionsPage() {
	return (
		<div>
			<PageHeader
				title="邮箱连接"
				subtitle="管理已连接的邮箱账户，Flowmail 会自动监听并提取业务事项"
			/>
			<EmailConnectionsList />
		</div>
	);
}
