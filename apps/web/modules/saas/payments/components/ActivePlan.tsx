"use client";

import { usePlanData } from "@saas/payments/hooks/plan-data";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { BadgeCheckIcon, CheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { CustomerPortalButton } from "../../settings/components/CustomerPortalButton";
import { SubscriptionStatusBadge } from "../../settings/components/SubscriptionStatusBadge";

export function ActivePlan({
	organizationId,
}: {
	organizationId?: string;
	seats?: number;
}) {
	const t = useTranslations();
	const format = useFormatter();
	const { planData } = usePlanData();
	const { activePlan } = usePurchases(organizationId);

	if (!activePlan) {
		return null;
	}

	const activePlanData = planData[activePlan.id as keyof typeof planData];

	if (!activePlanData) {
		return null;
	}

	const price = "price" in activePlan ? activePlan.price : null;

	return (
		<SettingsItem title={t("settings.billing.activePlan.title")}>
			<div className="rounded-lg border p-4">
				<div className="">
					<div className="flex items-center gap-2">
						<BadgeCheckIcon className="size-6 text-primary" />
						<h4 className="font-bold text-lg text-primary">
							<span>{activePlanData.title}</span>
						</h4>
						{activePlan.status && (
							<SubscriptionStatusBadge
								status={activePlan.status}
							/>
						)}
					</div>

					{!!activePlanData.features?.length && (
						<ul className="mt-2 grid list-none gap-2 text-sm">
							{activePlanData.features.map((feature, key) => (
								<li
									key={key}
									className="flex items-center justify-start"
								>
									<CheckIcon className="mr-2 size-4 text-primary" />
									<span>{feature}</span>
								</li>
							))}
						</ul>
					)}

					{price && (
						<strong
							className="mt-2 block font-medium text-2xl lg:text-3xl"
							data-test="price-table-plan-price"
						>
							{format.number(price.amount, {
								style: "currency",
								currency: price.currency,
							})}
							{"interval" in price && (
								<span className="font-normal text-xs opacity-60">
									{" / "}
									{price.interval === "month"
										? t("pricing.month", {
												count: price.intervalCount ?? 1,
											})
										: t("pricing.year", {
												count: price.intervalCount ?? 1,
											})}
								</span>
							)}
							{organizationId &&
								"seatBased" in price &&
								price.seatBased && (
									<span className="font-normal text-xs opacity-60">
										{" / "}
										{t("pricing.perSeat")}
									</span>
								)}
						</strong>
					)}
				</div>

				{"purchaseId" in activePlan && activePlan.purchaseId && (
					<div className="mt-4 flex justify-end">
						<div className="flex w-full flex-col flex-wrap gap-2 md:flex-row">
							<CustomerPortalButton
								purchaseId={activePlan.purchaseId}
							/>
						</div>
					</div>
				)}
			</div>
		</SettingsItem>
	);
}
