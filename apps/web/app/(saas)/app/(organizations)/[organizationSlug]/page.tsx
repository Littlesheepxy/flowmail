import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { DashboardCards } from "@flowmail/components/DashboardCards";
import { notFound } from "next/navigation";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug as string);
	return { title: activeOrganization?.name ?? "Dashboard" };
}

export default async function OrganizationPage({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug as string);

	if (!activeOrganization) {
		return notFound();
	}

	return (
		<div>
			<PageHeader
				title="Dashboard"
				subtitle="Turn emails into actionable workflows"
			/>
			<DashboardCards />
		</div>
	);
}
