import { config } from "@repo/config";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import UserStart from "@saas/start/UserStart";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function AppStartPage() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	const organizations = await getOrganizationList();

	if (
		config.organizations.enable &&
		config.organizations.requireOrganization
	) {
		const organization =
			organizations.find(
				(org) => org.id === session?.session.activeOrganizationId,
			) || organizations[0];

		if (!organization) {
			redirect("/new-organization");
		}

		redirect(`/app/${organization.slug}`);
	}

	const t = await getTranslations();

	return (
		<div className="">
			<PageHeader
				title={t("start.welcome", { name: session?.user.name })}
				subtitle={t("start.subtitle")}
			/>

			<UserStart />
		</div>
	);
}
