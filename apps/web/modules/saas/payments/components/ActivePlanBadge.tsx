"use client";

import { usePlanData } from "@saas/payments/hooks/plan-data";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { Badge } from "@ui/components/badge";

export function ActivePlanBadge({
	organizationId,
}: {
	organizationId?: string;
}) {
	const { planData } = usePlanData();
	const { activePlan } = usePurchases(organizationId);

	if (!activePlan) {
		return null;
	}

	const activePlanData = planData[activePlan.id as keyof typeof planData];

	if (!activePlanData) {
		return null;
	}
	return (
		<Badge
			status="info"
			className="flex items-center gap-1 px-1.5 text-xs normal-case"
		>
			{activePlanData.title}
		</Badge>
	);
}
