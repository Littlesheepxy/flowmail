import { type Config, config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { usePurchasesQuery } from "@saas/payments/lib/api";

const plans = config.payments.plans as Config["payments"]["plans"];

export const usePurchases = (organizationId?: string) => {
	const { data: purchases } = usePurchasesQuery(organizationId);

	const { activePlan, hasSubscription, hasPurchase } = createPurchasesHelper(
		purchases ?? [],
	);

	return { purchases, activePlan, hasSubscription, hasPurchase };
};

export const useUserPurchases = () => usePurchases();

export const useOrganizationPurchases = (organizationId: string) =>
	usePurchases(organizationId);
