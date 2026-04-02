"use client";

import { BlurFade } from "@repo/ui/components/blur-fade";
import { NumberTicker } from "@repo/ui/components/number-ticker";
import { ClockIcon, TargetIcon, MailIcon, LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const metrics = [
	{ labelKey: "speed", valueKey: "speedValue", icon: ClockIcon, ticker: null },
	{
		labelKey: "accuracy",
		valueKey: "accuracyValue",
		icon: TargetIcon,
		ticker: { value: 98.5, suffix: "%", decimals: 1 },
	},
	{
		labelKey: "platforms",
		valueKey: "platformsValue",
		icon: MailIcon,
		ticker: { value: 6, suffix: "+", decimals: 0 },
	},
	{
		labelKey: "encryption",
		valueKey: "encryptionValue",
		icon: LockIcon,
		ticker: null,
	},
] as const;

export function MetricsSection() {
	const t = useTranslations("metrics");

	return (
		<section className="py-10 lg:py-14 bg-muted/30 border-y border-border/40">
			<div className="container">
				<div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
					{metrics.map((metric, i) => {
						const Icon = metric.icon;
						return (
							<BlurFade key={metric.labelKey} delay={i * 0.1} inView>
								<div className="text-center">
									<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div className="text-2xl font-semibold text-foreground lg:text-3xl">
										{metric.ticker ? (
											<>
												<NumberTicker
													value={metric.ticker.value}
													decimalPlaces={metric.ticker.decimals}
												/>
												{metric.ticker.suffix}
											</>
										) : (
											t(metric.valueKey)
										)}
									</div>
									<p className="mt-1 text-xs text-foreground/50 font-medium uppercase tracking-wider">
										{t(metric.labelKey)}
									</p>
								</div>
							</BlurFade>
						);
					})}
				</div>
			</div>
		</section>
	);
}
