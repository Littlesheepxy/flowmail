"use client";

import { BlurFade } from "@repo/ui/components/blur-fade";
import { MagicCard } from "@repo/ui/components/magic-card";
import { BrainCircuitIcon, FileCheck2Icon, TrendingUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const cases = [
	{
		titleKey: "approval.title",
		descKey: "approval.description",
		exampleKey: "approval.example",
		icon: FileCheck2Icon,
		gradientFrom: "#f59e0b",
		gradientTo: "#fbbf24",
	},
	{
		titleKey: "tracking.title",
		descKey: "tracking.description",
		exampleKey: "tracking.example",
		icon: TrendingUpIcon,
		gradientFrom: "#3b82f6",
		gradientTo: "#60a5fa",
	},
	{
		titleKey: "classification.title",
		descKey: "classification.description",
		exampleKey: "classification.example",
		icon: BrainCircuitIcon,
		gradientFrom: "#8b5cf6",
		gradientTo: "#a78bfa",
	},
] as const;

const domainKeys = [
	"legal",
	"finance",
	"investment",
	"pm",
	"supply",
	"client",
	"hr",
	"engineering",
] as const;

export function UseCasesSection() {
	const t = useTranslations("useCases");

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
					{cases.map((item, i) => {
						const Icon = item.icon;
						return (
							<BlurFade
								key={item.titleKey}
								delay={0.1 + i * 0.1}
								inView
							>
								<MagicCard
									className="rounded-xl p-6 h-full"
									gradientFrom={item.gradientFrom}
									gradientTo={item.gradientTo}
									gradientOpacity={0.15}
								>
									<div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 mb-4">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<h3 className="text-lg font-medium text-foreground">
										{t(item.titleKey)}
									</h3>
									<p className="mt-2 text-sm text-foreground/55 leading-relaxed">
										{t(item.descKey)}
									</p>
									<p className="mt-3 text-xs text-foreground/35 leading-relaxed border-t border-border/40 pt-3">
										{t(item.exampleKey)}
									</p>
								</MagicCard>
							</BlurFade>
						);
					})}
				</div>

				{/* Business domain tag strip */}
				<BlurFade delay={0.4} inView>
					<div className="mt-10 text-center">
						<p className="text-xs font-medium uppercase tracking-wider text-foreground/40 mb-4">
							{t("domainsLabel")}
						</p>
						<div className="flex flex-wrap justify-center gap-2">
							{domainKeys.map((key) => (
								<span
									key={key}
									className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground/60 transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/30"
								>
									{t(`domains.${key}`)}
								</span>
							))}
						</div>
					</div>
				</BlurFade>
			</div>
		</section>
	);
}
