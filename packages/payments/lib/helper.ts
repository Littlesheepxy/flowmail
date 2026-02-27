import type { PurchaseSchema } from "@repo/database";
import type { z } from "zod";
import { config } from "../config";

type PlanId = keyof typeof config.plans;
type PurchaseWithoutTimestamps = Omit<
	z.infer<typeof PurchaseSchema>,
	"createdAt" | "updatedAt"
>;

const planEntries = Object.entries(config.plans);

function getActivePlanFromPurchases(purchases?: PurchaseWithoutTimestamps[]) {
	const subscriptionPurchase = purchases?.find(
		(purchase) => purchase.type === "SUBSCRIPTION",
	);

	if (subscriptionPurchase) {
		const plan = planEntries.find(
			([_, plan]) =>
				"prices" in plan &&
				plan.prices?.some(
					(price) =>
						price.productId === subscriptionPurchase.productId,
				),
		);

		if (!plan) {
			return null;
		}

		const [planId, planDetails] = plan;

		return {
			id: planId as PlanId,
			price:
				"prices" in planDetails
					? planDetails.prices.find(
							(price) =>
								price.productId ===
								subscriptionPurchase.productId,
						)
					: undefined,
			status: subscriptionPurchase.status || "active",
			purchaseId: subscriptionPurchase.id,
		};
	}

	const oneTimePurchase = purchases?.find(
		(purchase) => purchase.type === "ONE_TIME",
	);

	if (oneTimePurchase) {
		const plan = planEntries.find(
			([_, plan]) =>
				"prices" in plan &&
				plan.prices?.some(
					(price) => price.productId === oneTimePurchase.productId,
				),
		);

		if (!plan) {
			return null;
		}

		const [planId, planDetails] = plan;

		return {
			id: planId as PlanId,
			price:
				"prices" in planDetails
					? planDetails.prices.find(
							(price) =>
								price.productId === oneTimePurchase.productId,
						)
					: undefined,
			status: "active",
			purchaseId: oneTimePurchase.id,
		};
	}

	const freePlan = planEntries.find(
		([_, plan]) => "isFree" in plan && plan.isFree,
	);

	return freePlan
		? {
				id: freePlan[0] as PlanId,
				price: undefined,
				status: "active",
			}
		: null;
}

export function createPurchasesHelper(purchases: PurchaseWithoutTimestamps[]) {
	const activePlan = getActivePlanFromPurchases(purchases);

	const hasSubscription = (planIds?: PlanId[] | PlanId) => {
		return (
			!!activePlan &&
			(Array.isArray(planIds)
				? planIds.includes(activePlan.id)
				: planIds === activePlan.id)
		);
	};

	const hasPurchase = (planId: PlanId) => {
		return !!purchases?.some((purchase) =>
			planEntries.find(([id]) => {
				if (id !== planId) {
					return false;
				}

				const plan = planEntries.find(([id]) => id === planId);
				if (!plan) {
					return false;
				}

				const [_, planDetails] = plan;

				return "prices" in planDetails
					? planDetails.prices?.some(
							(price) => price.productId === purchase.productId,
						)
					: false;
			}),
		);
	};

	return { activePlan, hasSubscription, hasPurchase };
}
