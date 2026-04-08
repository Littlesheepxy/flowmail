"use client";

import { authLoginHref } from "@i18n/lib/auth-login-href";
import { LocaleLink } from "@i18n/routing";
import { BlurFade } from "@repo/ui/components/blur-fade";
import { Button } from "@repo/ui/components/button";
import { NoiseBackground } from "@repo/ui/components/ui/noise-background";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { config } from "@/config";
import { HeroDemoVisual } from "./HeroDemoVisual";
import { InviteGateForm } from "./InviteGateForm";

export function Hero() {
	const t = useTranslations();
	const locale = useLocale();

	return (
		<div className="relative max-w-full overflow-x-hidden">
			<div className="container relative z-20 pt-24 pb-12 lg:pb-16">
				<div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
					{/* Left: Text content */}
					<div>
						<BlurFade delay={0} inView>
							<div className="mb-4 flex justify-start">
								<NoiseBackground
									containerClassName="w-fit rounded-full p-2"
									gradientColors={[
										"rgb(255, 100, 150)",
										"rgb(100, 150, 255)",
										"rgb(255, 200, 100)",
									]}
									noiseIntensity={0.15}
									speed={0.08}
								>
									<div className="rounded-full bg-linear-to-r from-neutral-100 via-neutral-100 to-white px-4 py-1.5 flex items-center gap-2 font-normal text-sm text-black shadow-[0px_2px_0px_0px_var(--color-neutral-50)_inset,0px_0.5px_1px_0px_var(--color-neutral-400)] dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 dark:text-white dark:shadow-[0px_1px_0px_0px_var(--color-neutral-950)_inset,0px_1px_0px_0px_var(--color-neutral-800)]">
										<span className="font-semibold">
											{t("hero.badge1")}
										</span>
										<span className="text-black/30 dark:text-white/30">
											&middot;
										</span>
										<span className="font-medium">
											{t("hero.badge2")}
										</span>
									</div>
								</NoiseBackground>
							</div>
						</BlurFade>

						<BlurFade delay={0.1} inView>
							<h1 className="text-3xl font-medium leading-tight text-foreground sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl">
								{t("hero.headline")}
							</h1>
						</BlurFade>

						<BlurFade delay={0.2} inView>
							<p className="mt-4 text-foreground/60 text-sm sm:text-base lg:text-lg max-w-xl">
								{t("hero.subtitle")}
							</p>
						</BlurFade>

						<BlurFade delay={0.3} inView>
							<div className="mt-6 flex items-center gap-2">
								{config.marketing.inviteCodeRequired ? (
									<InviteGateForm />
								) : (
									<>
										<Button
											size="lg"
											variant="primary"
											asChild
										>
											<Link href={authLoginHref(locale)}>
												{t("hero.cta")}
												<ArrowRightIcon className="ml-2 size-4" />
											</Link>
										</Button>
										{config.docsLink && (
											<Button
												variant="ghost"
												size="lg"
												asChild
											>
												<LocaleLink
													href={config.docsLink}
												>
													{t("hero.docs")}
												</LocaleLink>
											</Button>
										)}
									</>
								)}
							</div>
						</BlurFade>
					</div>

					{/* Right: Animated demo */}
					<BlurFade delay={0.2} inView direction="right">
						<HeroDemoVisual />
					</BlurFade>
				</div>
			</div>
		</div>
	);
}
