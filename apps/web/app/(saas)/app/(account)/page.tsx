import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import UserStart from "@saas/start/UserStart";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export default async function AppStartPage() {
	const session = await getSession();

	if (!session) {
		return redirect("/auth/login");
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
