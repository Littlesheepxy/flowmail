import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { MemoryManagerPanel } from "@flowmail/components/MemoryManagerPanel";
import { notFound } from "next/navigation";

export const metadata = { title: "AI 记忆" };

export default async function AIMemoryPage({
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
				title="AI 记忆"
				subtitle="AI 在使用过程中自动构建的结构化认知——关于你、联系人、项目的持久记忆。"
			/>
			<MemoryManagerPanel organizationId={organization.id} />
		</div>
	);
}
