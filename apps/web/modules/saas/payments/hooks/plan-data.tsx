import type { config } from "@repo/config";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type ProductReferenceId = keyof (typeof config)["payments"]["plans"];

export function usePlanData() {
	const t = useTranslations();

	const planData: Record<
		ProductReferenceId,
		{
			title: string;
			description: ReactNode;
			features: ReactNode[];
		}
	> = {
		free: {
			title: t("pricing.products.free.title"),
			description: t("pricing.products.free.description"),
			features: [
				t("pricing.products.free.features.anotherFeature"),
				t("pricing.products.free.features.limitedSupport"),
			],
		},
		pro: {
			title: t("pricing.products.pro.title"),
			description: t("pricing.products.pro.description"),
			features: [
				t("pricing.products.pro.features.anotherFeature"),
				t("pricing.products.pro.features.fullSupport"),
			],
		},
		enterprise: {
			title: t("pricing.products.enterprise.title"),
			description: t("pricing.products.enterprise.description"),
			features: [
				t("pricing.products.enterprise.features.unlimitedProjects"),
				t("pricing.products.enterprise.features.enterpriseSupport"),
			],
		},
		lifetime: {
			title: t("pricing.products.lifetime.title"),
			description: t("pricing.products.lifetime.description"),
			features: [
				t("pricing.products.lifetime.features.noRecurringCosts"),
				t("pricing.products.lifetime.features.extendSupport"),
			],
		},
	};

	return { planData };
}
