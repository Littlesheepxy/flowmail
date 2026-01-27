"use client";
import { PricingTable } from "@saas/payments/components/PricingTable";
import { useTranslations } from "next-intl";

export function PricingSection() {
	const t = useTranslations();

	return (
		<section id="pricing" className="scroll-mt-16 py-12 lg:py-16 xl:py-24">
			<div className="container">
				<div className="mb-6">
					<h1 className="font-serif font-medium text-2xl md:text-3xl lg:text-4xl xl:text-5xl leading-tighter text-foreground">
						{t("pricing.title")}
					</h1>
					<p className="mt-3 text-foreground/60 text-sm sm:text-lg">
						{t("pricing.description")}
					</p>
				</div>

				<PricingTable />
			</div>
		</section>
	);
}
