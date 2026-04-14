import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { AgentSettingsPanel } from "@flowmail/components/AgentSettingsPanel";
import { notFound } from "next/navigation";

export const metadata = { title: "Agent 接入" };

export default async function AgentPage({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Agent 接入"
				subtitle="通过 MCP 协议接入各类 AI Agent，实现跨系统自动协同。"
			/>
			<AgentSettingsPanel organizationId={organization.id} />
		</div>
	);
}
