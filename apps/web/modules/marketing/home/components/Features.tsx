"use client";

import { BlurFade } from "@repo/ui/components/blur-fade";
import { MagicCard } from "@repo/ui/components/magic-card";
import {
	BarChart3Icon,
	CpuIcon,
	InboxIcon,
	ZapIcon,
} from "lucide-react";
import type { JSXElementConstructor, ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
	InboxVisual,
	ActionsVisual,
	InsightsVisual,
	AgentsVisual,
} from "./feature-visuals";

interface FeatureTab {
	id: string;
	title: string;
	icon: JSXElementConstructor<any>;
	subtitle?: string;
	description?: ReactNode;
	visual?: ReactNode;
	highlights?: {
		title: string;
		description: string;
		icon: JSXElementConstructor<any>;
	}[];
}

function useFeatureTabs(): FeatureTab[] {
	const t = useTranslations("features");

	return [
		{
			id: "inbox",
			title: t("inbox.title"),
			icon: InboxIcon,
			subtitle: t("inbox.subtitle"),
			description: t("inbox.description"),
			visual: <InboxVisual />,
			highlights: [
				{ title: t("inbox.b1"), description: t("inbox.b1d"), icon: InboxIcon },
				{ title: t("inbox.b2"), description: t("inbox.b2d"), icon: InboxIcon },
				{ title: t("inbox.b3"), description: t("inbox.b3d"), icon: InboxIcon },
			],
		},
		{
			id: "actions",
			title: t("actions.title"),
			icon: ZapIcon,
			subtitle: t("actions.subtitle"),
			description: t("actions.description"),
			visual: <ActionsVisual />,
			highlights: [
				{ title: t("actions.b1"), description: t("actions.b1d"), icon: ZapIcon },
				{ title: t("actions.b2"), description: t("actions.b2d"), icon: ZapIcon },
				{ title: t("actions.b3"), description: t("actions.b3d"), icon: ZapIcon },
			],
		},
		{
			id: "insights",
			title: t("insights.title"),
			icon: BarChart3Icon,
			subtitle: t("insights.subtitle"),
			description: t("insights.description"),
			visual: <InsightsVisual />,
			highlights: [
				{ title: t("insights.b1"), description: t("insights.b1d"), icon: BarChart3Icon },
				{ title: t("insights.b2"), description: t("insights.b2d"), icon: BarChart3Icon },
				{ title: t("insights.b3"), description: t("insights.b3d"), icon: BarChart3Icon },
			],
		},
		{
			id: "agents",
			title: t("agents.title"),
			icon: CpuIcon,
			subtitle: t("agents.subtitle"),
			description: t("agents.description"),
			visual: <AgentsVisual />,
			highlights: [
				{ title: t("agents.b1"), description: t("agents.b1d"), icon: CpuIcon },
				{ title: t("agents.b2"), description: t("agents.b2d"), icon: CpuIcon },
				{ title: t("agents.b3"), description: t("agents.b3d"), icon: CpuIcon },
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

			<div>
				<div className="container mt-8 lg:mt-12 grid grid-cols-1 gap-8 md:gap-12 lg:gap-16 xl:gap-24">
					{featureTabs.map((tab, index) => {
						const isReversed = index % 2 !== 0;
						const filteredHighlights = tab.highlights || [];

						return (
							<BlurFade
								key={tab.id}
								delay={index * 0.15}
								inView
								direction={isReversed ? "right" : "left"}
							>
								<div>
									<div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
										<div className={isReversed ? "md:order-last" : ""}>
											{tab.visual}
										</div>

										<div className={isReversed ? "md:order-first" : ""}>
											<h3 className="font-normal text-lg text-foreground leading-tight md:text-xl lg:text-2xl">
												<span className="font-medium">
													{tab.title}.{" "}
												</span>
												<span className="font-sans">
													{tab.subtitle}
												</span>
											</h3>

											{tab.description && (
												<p className="mt-4 text-foreground/60">
													{tab.description}
												</p>
											)}
										</div>
									</div>

									{filteredHighlights.length > 0 && (
										<div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:mt-12">
											{filteredHighlights.map((highlight, k) => (
												<BlurFade
													key={`highlight-${k}`}
													delay={0.1 + k * 0.1}
													inView
												>
													<MagicCard className="rounded-2xl p-4 lg:p-6 h-full">
														<div>
															<highlight.icon
																className="text-primary text-xl"
																width="1em"
																height="1em"
															/>
															<strong className="mt-2 block font-medium text-lg">
																{highlight.title}
															</strong>
															<p className="mt-1 text-sm text-foreground/60">
																{highlight.description}
															</p>
														</div>
													</MagicCard>
												</BlurFade>
											))}
										</div>
									)}
								</div>
							</BlurFade>
						);
					})}
				</div>
			</div>
		</section>
	);
}
