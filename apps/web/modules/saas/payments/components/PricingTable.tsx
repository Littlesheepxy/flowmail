"use client";
import { LocaleLink } from "@i18n/routing";
import { type Config, config } from "@repo/config";
import { usePlanData } from "@saas/payments/hooks/plan-data";
import type { PlanId } from "@saas/payments/types";
import { useLocaleCurrency } from "@shared/hooks/locale-currency";
import { useRouter } from "@shared/hooks/router";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@ui/components/tabs";
import { cn } from "@ui/lib";
import {
	ArrowRightIcon,
	BadgePercentIcon,
	CheckIcon,
	PhoneIcon,
	StarIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

const plans = config.payments.plans as Config["payments"]["plans"];

export function PricingTable({
	className,
	userId,
	organizationId,
	activePlanId,
}: {
	className?: string;
	userId?: string;
	organizationId?: string;
	activePlanId?: string;
}) {
	const t = useTranslations();
	const format = useFormatter();
	const router = useRouter();
	const localeCurrency = useLocaleCurrency();
	const [loading, setLoading] = useState<PlanId | false>(false);
	const [interval, setInterval] = useState<"month" | "year">("month");

	const { planData } = usePlanData();

	const createCheckoutLinkMutation = useMutation(
		orpc.payments.createCheckoutLink.mutationOptions(),
	);

	const onSelectPlan = async (planId: PlanId, productId?: string) => {
		if (!(userId || organizationId)) {
			router.push("/auth/signup");
			return;
		}

		const plan = plans[planId];
		const price = plan.prices?.find(
			(price) => price.productId === productId,
		);

		if (!price) {
			return;
		}

		setLoading(planId);

		try {
			const { checkoutLink } =
				await createCheckoutLinkMutation.mutateAsync({
					type:
						price.type === "one-time" ? "one-time" : "subscription",
					productId: price.productId,
					organizationId,
					redirectUrl: window.location.href,
				});

			window.location.href = checkoutLink;
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	const filteredPlans = Object.entries(plans).filter(
		([planId]) =>
			planId !== activePlanId && (!activePlanId || planId !== "free"),
	);

	const hasSubscriptions = filteredPlans.some(([_, plan]) =>
		plan.prices?.some((price) => price.type === "recurring"),
	);

	return (
		<div className={cn("@container", className)}>
			{hasSubscriptions && (
				<div className="mb-6 flex @xl:justify-center">
					<Tabs
						value={interval}
						onValueChange={(value) =>
							setInterval(value as typeof interval)
						}
						data-test="price-table-interval-tabs"
					>
						<TabsList className="border-foreground/10">
							<TabsTrigger value="month">
								{t("pricing.monthly")}
							</TabsTrigger>
							<TabsTrigger value="year">
								{t("pricing.yearly")}
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			)}
			<div
				className={cn("grid grid-cols-1 gap-4", {
					"@xl:grid-cols-2": filteredPlans.length >= 2,
					"@3xl:grid-cols-3": filteredPlans.length >= 3,
					"@4xl:grid-cols-4": filteredPlans.length >= 4,
				})}
			>
				{filteredPlans
					.filter(([planId]) => planId !== activePlanId)
					.map(([planId, plan]) => {
						const { isFree, isEnterprise, prices, recommended } =
							plan;
						const { title, description, features } =
							planData[planId as keyof typeof planData];

						let price = prices?.find(
							(price) =>
								!price.hidden &&
								(price.type === "one-time" ||
									price.interval === interval) &&
								price.currency === localeCurrency,
						);

						if (isFree) {
							price = {
								amount: 0,
								currency: localeCurrency,
								interval,
								productId: "",
								type: "recurring",
							};
						}

						if (!(price || isEnterprise)) {
							return null;
						}

						return (
							<div
								key={planId}
								className={cn("rounded-3xl border p-6", {
									"border-2 border-primary": recommended,
								})}
								data-test="price-table-plan"
							>
								<div className="flex h-full flex-col justify-between gap-4">
									<div>
										{recommended && (
											<div className="-mt-9 flex justify-center">
												<div className="mb-2 flex h-6 w-auto items-center gap-1.5 rounded-full bg-primary px-2 py-1 font-semibold text-primary-foreground text-xs">
													<StarIcon className="size-3" />
													{t("pricing.recommended")}
												</div>
											</div>
										)}
										<h3
											className={cn(
												"my-0 font-semibold text-2xl",
												{
													"font-bold text-primary":
														recommended,
												},
											)}
										>
											{title}
										</h3>
										{description && (
											<div className="prose mt-2 text-foreground/60 text-sm">
												{description}
											</div>
										)}

										{!!features?.length && (
											<ul className="mt-4 grid list-none gap-2 text-sm">
												{features.map(
													(feature, key) => (
														<li
															key={key}
															className="flex items-center justify-start"
														>
															<CheckIcon className="mr-2 size-4 text-primary" />
															<span>
																{feature}
															</span>
														</li>
													),
												)}
											</ul>
										)}

										{price &&
											"trialPeriodDays" in price &&
											price.trialPeriodDays && (
												<div className="mt-4 flex items-center justify-start font-medium text-primary text-sm opacity-80">
													<BadgePercentIcon className="mr-2 size-4" />
													{t("pricing.trialPeriod", {
														days: price.trialPeriodDays,
													})}
												</div>
											)}
									</div>

									<div>
										{price && (
											<strong
												className="block font-medium text-2xl lg:text-3xl"
												data-test="price-table-plan-price"
											>
												{format.number(price.amount, {
													style: "currency",
													currency: price.currency,
												})}
												{"interval" in price && (
													<span className="font-normal text-xs opacity-60">
														{" / "}
														{interval === "month"
															? t(
																	"pricing.month",
																	{
																		count:
																			price.intervalCount ??
																			1,
																	},
																)
															: t(
																	"pricing.year",
																	{
																		count:
																			price.intervalCount ??
																			1,
																	},
																)}
													</span>
												)}
												{organizationId &&
													"seatBased" in price &&
													price.seatBased && (
														<span className="font-normal text-xs opacity-60">
															{" / "}
															{t(
																"pricing.perSeat",
															)}
														</span>
													)}
											</strong>
										)}

										{isEnterprise ? (
											<Button
												className="mt-4 w-full"
												variant="light"
												asChild
											>
												<LocaleLink href="/contact">
													<PhoneIcon className="mr-2 size-4" />
													{t("pricing.contactSales")}
												</LocaleLink>
											</Button>
										) : (
											<Button
												className="mt-4 w-full"
												variant={
													recommended
														? "primary"
														: "secondary"
												}
												onClick={() =>
													onSelectPlan(
														planId as PlanId,
														price?.productId,
													)
												}
												loading={loading === planId}
											>
												{userId || organizationId
													? t("pricing.choosePlan")
													: t("pricing.getStarted")}
												<ArrowRightIcon className="ml-2 size-4" />
											</Button>
										)}
									</div>
								</div>
							</div>
						);
					})}
			</div>
		</div>
	);
}
