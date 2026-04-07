"use client";

import { BlurFade } from "@repo/ui/components/blur-fade";
import {
	BarChart3Icon,
	CheckCircle2Icon,
	ZapIcon,
} from "lucide-react";
import type { JSXElementConstructor, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ActionsVisual, InsightsVisual } from "./feature-visuals";

interface FeatureTab {
	id: string;
	title: string;
	icon: JSXElementConstructor<{ className?: string }>;
	subtitle?: string;
	description?: ReactNode;
	visual?: ReactNode;
	bullets?: { title: string; description: string }[];
}

function useFeatureTabs(): FeatureTab[] {
	const t = useTranslations("features");

	return [
		{
			id: "actions",
			title: t("actions.title"),
			icon: ZapIcon,
			subtitle: t("actions.subtitle"),
			description: t("actions.description"),
			visual: <ActionsVisual />,
			bullets: [
				{ title: t("actions.b1"), description: t("actions.b1d") },
				{ title: t("actions.b2"), description: t("actions.b2d") },
				{ title: t("actions.b3"), description: t("actions.b3d") },
			],
		},
		{
			id: "insights",
			title: t("insights.title"),
			icon: BarChart3Icon,
			subtitle: t("insights.subtitle"),
			description: t("insights.description"),
			visual: <InsightsVisual />,
			bullets: [
				{ title: t("insights.b1"), description: t("insights.b1d") },
				{ title: t("insights.b2"), description: t("insights.b2d") },
				{ title: t("insights.b3"), description: t("insights.b3d") },
			],
		},
	];
}

export function Features() {
	const t = useTranslations("features");
	const featureTabs = useFeatureTabs();

	return (
		<section id="features" className="scroll-my-20 py-12 lg:py-16 xl:py-24">
			<div className="container">
				<BlurFade inView>
					<div className="mb-6 lg:mb-0 max-w-3xl">
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
			</div>

			<div className="container mt-8 lg:mt-12 grid grid-cols-1 gap-12 lg:gap-20 xl:gap-28">
				{featureTabs.map((tab, index) => {
					const isReversed = index % 2 !== 0;

					return (
						<BlurFade
							key={tab.id}
							delay={index * 0.15}
							inView
							direction={isReversed ? "right" : "left"}
						>
							<div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12">
								<div
									className={
										isReversed ? "md:order-last" : ""
									}
								>
									{tab.visual}
								</div>

								<div
									className={
										isReversed ? "md:order-first" : ""
									}
								>
									<h3 className="font-normal text-lg text-foreground leading-tight md:text-xl lg:text-2xl">
										<span className="font-medium">
											{tab.title}.{" "}
										</span>
										<span className="font-sans">
											{tab.subtitle}
										</span>
									</h3>

									{tab.description && (
										<p className="mt-4 text-foreground/60 text-sm lg:text-base">
											{tab.description}
										</p>
									)}

									{tab.bullets && (
										<ul className="mt-5 space-y-3">
											{tab.bullets.map((bullet) => (
												<li
													key={bullet.title}
													className="flex gap-3"
												>
													<CheckCircle2Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
													<div>
														<span className="font-medium text-sm">
															{bullet.title}
														</span>
														<p className="text-sm text-foreground/50 mt-0.5">
															{bullet.description}
														</p>
													</div>
												</li>
											))}
										</ul>
									)}
								</div>
							</div>
						</BlurFade>
					);
				})}
			</div>
		</section>
	);
}
