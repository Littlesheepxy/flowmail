import { ForgotPasswordForm } from "@saas/auth/components/ForgotPasswordForm";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("auth.forgotPassword.title"),
	};
}

export default function ForgotPasswordPage() {
	return <ForgotPasswordForm />;
}
