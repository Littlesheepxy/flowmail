import { PageHeader } from "@saas/shared/components/PageHeader";
import { EmailConnectionsList } from "@flowmail/components/EmailConnectionsList";
import { InboundDropBox } from "@flowmail/components/InboundDropBox";

export const metadata = { title: "Connections" };

export default function ConnectionsPage() {
	return (
		<div className="space-y-8">
			<PageHeader
				title="邮箱连接"
				subtitle="输入邮箱地址，系统自动检测最佳连接方式。OAuth 优先，转发兜底。"
			/>
			<InboundDropBox />
			<EmailConnectionsList />
		</div>
	);
}
