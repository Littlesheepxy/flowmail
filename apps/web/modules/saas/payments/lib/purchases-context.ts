import type { PlanId } from "@saas/payments/types";
import React from "react";

export const PurchasesContext = React.createContext<
	| {
			activeSubscription: {
				id: string;
				purchaseId?: string;
			} | null;
			loaded: boolean;
			hasSubscription: (planIds?: PlanId[] | PlanId) => boolean;
			refetchPurchases: () => Promise<void>;
			hasPurchase: (planId: PlanId) => boolean;
	  }
	| undefined
>(undefined);
