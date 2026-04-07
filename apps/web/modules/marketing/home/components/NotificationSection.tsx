"use client";

import { BlurFade } from "@repo/ui/components/blur-fade";
import { MagicCard } from "@repo/ui/components/magic-card";
import {
	BellRingIcon,
	AlertTriangleIcon,
	GitBranchIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

const cards = [
	{
		titleKey: "approval.title",
		descKey: "approval.description",
		icon: BellRingIcon,
		gradientFrom: "#f59e0b",
		gradientTo: "#fbbf24",
	},
	{
		titleKey: "anomaly.title",
		descKey: "anomaly.description",
		icon: AlertTriangleIcon,
		gradientFrom: "#ef4444",
		gradientTo: "#f87171",
	},
	{
		titleKey: "timeline.title",
		descKey: "timeline.description",
		icon: GitBranchIcon,
		gradientFrom: "#3b82f6",
		gradientTo: "#60a5fa",
	},
] as const;

export function NotificationSection() {
	const t = useTranslations("notifications");

	return (
		<section className="py-12 lg:py-16 xl:py-24">
			<div className="container">
				<BlurFade inView>
					<div className="max-w-3xl">
						<small className="font-medium text-xs uppercase tracking-wider text-primary mb-4 block">
							{t("label")}
						</small>
						<h2 className="text-3xl lg:text-4xl xl:text-5xl font-medium">
							{t("title")}
						</h2>
						<p className="mt-2 text-base lg:text-lg text-foreground/60">
							{t("description")}
						</p>
					</div>
				</BlurFade>

				<div className="mt-8 lg:mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
					{cards.map((card, i) => {
						const Icon = card.icon;
						return (
							<BlurFade key={card.titleKey} delay={0.1 + i * 0.1} inView>
								<MagicCard
									className="rounded-xl p-6 h-full"
									gradientFrom={card.gradientFrom}
									gradientTo={card.gradientTo}
									gradientOpacity={0.15}
								>
									<div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 mb-4">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<h3 className="text-lg font-medium text-foreground">
										{t(card.titleKey)}
									</h3>
									<p className="mt-2 text-sm text-foreground/55 leading-relaxed">
										{t(card.descKey)}
									</p>
								</MagicCard>
							</BlurFade>
						);
					})}
				</div>
			</div>
		</section>
	);
}
