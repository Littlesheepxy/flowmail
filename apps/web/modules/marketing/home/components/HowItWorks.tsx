"use client";

import { AnimatedBeam } from "@repo/ui/components/animated-beam";
import { BlurFade } from "@repo/ui/components/blur-fade";
import { MagicCard } from "@repo/ui/components/magic-card";
import { InboxIcon, CpuIcon, ZapIcon } from "lucide-react";
import { useRef } from "react";
import { useTranslations } from "next-intl";

const steps = [
	{
		key: "step1",
		icon: InboxIcon,
		gradientFrom: "#3b82f6",
		gradientTo: "#60a5fa",
		number: "01",
	},
	{
		key: "step2",
		icon: CpuIcon,
		gradientFrom: "#8b5cf6",
		gradientTo: "#a78bfa",
		number: "02",
	},
	{
		key: "step3",
		icon: ZapIcon,
		gradientFrom: "#22c55e",
		gradientTo: "#4ade80",
		number: "03",
	},
] as const;

export function HowItWorks() {
	const t = useTranslations("howItWorks");
	const containerRef = useRef<HTMLDivElement>(null);
	const step1Ref = useRef<HTMLDivElement>(null);
	const step2Ref = useRef<HTMLDivElement>(null);
	const step3Ref = useRef<HTMLDivElement>(null);
	const stepRefs = [step1Ref, step2Ref, step3Ref];

	return (
		<section className="py-12 lg:py-16 xl:py-24">
			<div className="container">
				<BlurFade inView>
					<div className="mx-auto max-w-2xl text-center mb-10 lg:mb-14">
						<small className="font-medium text-xs uppercase tracking-wider text-primary mb-4 block">
							{t("label")}
						</small>
						<h2 className="text-3xl font-medium lg:text-4xl xl:text-5xl">
							{t("title")}
						</h2>
						<p className="mt-2 text-base text-foreground/60 lg:text-lg">
							{t("description")}
						</p>
					</div>
				</BlurFade>

				<div
					ref={containerRef}
					className="relative grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8"
				>
					{steps.map((step, i) => {
						const Icon = step.icon;
						return (
							<BlurFade
								key={step.key}
								delay={0.1 + i * 0.15}
								inView
							>
								<MagicCard
									className="rounded-2xl p-6 lg:p-8 h-full text-center"
									gradientFrom={step.gradientFrom}
									gradientTo={step.gradientTo}
									gradientOpacity={0.3}
								>
									<div className="flex flex-col items-center">
										<div
											ref={stepRefs[i]}
											className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
										>
											<Icon className="h-6 w-6 text-primary" />
										</div>
										<span className="text-[10px] font-bold uppercase tracking-widest text-foreground/30 mb-2">
											{step.number}
										</span>
										<h3 className="text-lg font-medium">
											{t(`${step.key}.title`)}
										</h3>
										<p className="mt-2 text-sm text-foreground/60 leading-relaxed">
											{t(`${step.key}.description`)}
										</p>
									</div>
								</MagicCard>
							</BlurFade>
						);
					})}

					{/* Animated beams connecting the steps (desktop only) */}
					<div className="hidden md:block">
						<AnimatedBeam
							containerRef={containerRef}
							fromRef={step1Ref}
							toRef={step2Ref}
							curvature={-30}
							pathWidth={1.5}
							pathOpacity={0.1}
							gradientStartColor="#3b82f6"
							gradientStopColor="#8b5cf6"
							duration={4}
							startXOffset={28}
							endXOffset={-28}
						/>
						<AnimatedBeam
							containerRef={containerRef}
							fromRef={step2Ref}
							toRef={step3Ref}
							curvature={-30}
							pathWidth={1.5}
							pathOpacity={0.1}
							gradientStartColor="#8b5cf6"
							gradientStopColor="#22c55e"
							duration={4}
							delay={1}
							startXOffset={28}
							endXOffset={-28}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
