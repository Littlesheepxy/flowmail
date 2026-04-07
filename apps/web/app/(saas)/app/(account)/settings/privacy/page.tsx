import { getSession } from "@saas/auth/lib/server";
import { ExportDataForm } from "@saas/settings/components/ExportDataForm";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("settings.privacy.title"),
	};
}

export default async function PrivacySettingsPage() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	return (
		<SettingsList>
			<ExportDataForm />
		</SettingsList>
	);
}
