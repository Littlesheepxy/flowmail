import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { PricingTable } from "@saas/payments/components/PricingTable";
import { getPurchases } from "@saas/payments/lib/server";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("choosePlan.title"),
	};
}

export default async function ChoosePlanPage() {
	const t = await getTranslations();
	const session = await getSession();

	if (!session) {
		return redirect("/auth/login");
	}

	let organizationId: string | undefined;
	if (config.organizations.enable && config.organizations.enableBilling) {
		const organization = (await getOrganizationList()).at(0);

		if (!organization) {
			redirect("/app/new-organization");
		}

		organizationId = organization.id;
	}

	const purchases = await getPurchases(organizationId);
	const { activePlan } = createPurchasesHelper(purchases);

	if (activePlan) {
		return redirect("/app");
	}

	return (
		<AuthWrapper contentClass="max-w-5xl">
			<div className="mb-4 text-center">
				<h1 className="text-center font-bold text-2xl lg:text-3xl">
					{t("choosePlan.title")}
				</h1>
				<p className="text-muted-foreground text-sm lg:text-base">
					{t("choosePlan.description")}
				</p>
			</div>

			<div>
				<PricingTable
					{...(organizationId
						? {
								organizationId,
							}
						: {
								userId: session.user.id,
							})}
				/>
			</div>
		</AuthWrapper>
	);
}
