import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { getActiveOrganization } from "@saas/auth/lib/server";
import { ActivePlan } from "@saas/payments/components/ActivePlan";
import { ChangePlan } from "@saas/payments/components/ChangePlan";
import { purchasesQueryKey } from "@saas/payments/lib/api";
import { getPurchases } from "@saas/payments/lib/server";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { getServerQueryClient } from "@shared/lib/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("settings.billing.title"),
	};
}

export default async function BillingSettingsPage({
	params,
}: {
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const purchases = await getPurchases(organization.id);
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery({
		queryKey: purchasesQueryKey(organization.id),
		queryFn: () => purchases,
	});

	const { activePlan } = createPurchasesHelper(purchases);

	return (
		<SettingsList>
			{activePlan && <ActivePlan organizationId={organization.id} />}
			<ChangePlan
				organizationId={organization.id}
				activePlanId={activePlan?.id}
			/>
		</SettingsList>
	);
}
