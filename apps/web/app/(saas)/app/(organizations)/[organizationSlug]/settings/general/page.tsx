import { ChangeOrganizationNameForm } from "@saas/organizations/components/ChangeOrganizationNameForm";
import { OrganizationLogoForm } from "@saas/organizations/components/OrganizationLogoForm";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("organizations.settings.title"),
	};
}

export default function OrganizationSettingsPage() {
	return (
		<SettingsList>
			<OrganizationLogoForm />
			<ChangeOrganizationNameForm />
		</SettingsList>
	);
}
