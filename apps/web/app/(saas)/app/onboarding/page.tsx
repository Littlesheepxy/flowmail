import { config } from "@repo/config";
import { getSession } from "@saas/auth/lib/server";
import { OnboardingForm } from "@saas/onboarding/components/OnboardingForm";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("onboarding.title"),
	};
}

export default async function OnboardingPage() {
	const session = await getSession();

	if (!session) {
		return redirect("/auth/login");
	}

	if (!config.users.enableOnboarding || session.user.onboardingComplete) {
		return redirect("/app");
	}

	return (
		<AuthWrapper>
			<OnboardingForm />
		</AuthWrapper>
	);
}
