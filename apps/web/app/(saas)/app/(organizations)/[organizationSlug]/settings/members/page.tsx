import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { InviteMemberForm } from "@saas/organizations/components/InviteMemberForm";
import { OrganizationMembersBlock } from "@saas/organizations/components/OrganizationMembersBlock";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("organizations.settings.title"),
	};
}

export default async function OrganizationSettingsPage({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const session = await getSession();
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<SettingsList>
			{isOrganizationAdmin(organization, session?.user) && (
				<InviteMemberForm organizationId={organization.id} />
			)}
			<OrganizationMembersBlock organizationId={organization.id} />
		</SettingsList>
	);
}
