"use client";

import { LocaleLink } from "@i18n/routing";
import { Button } from "@repo/ui/components/button";
import { BlurFade } from "@repo/ui/components/blur-fade";
import { TypewriterEffect } from "@repo/ui/components/ui/typewriter-effect";
import ColourfulText from "@repo/ui/components/ui/colourful-text";
import { NoiseBackground } from "@repo/ui/components/ui/noise-background";
import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { config } from "@/config";
import { WaitlistForm } from "./WaitlistForm";
import heroImage from "../../../../public/images/hero-image.png";
import heroImageDark from "../../../../public/images/hero-image-dark.png";

export function Hero() {
	const t = useTranslations();

	const headlineWords = t("hero.headline")
		.split(" ")
		.map((text) => ({ text }));

	return (
		<div className="relative max-w-full overflow-x-hidden">
			<div className="container relative z-20 pt-24 pb-12 lg:pb-16">
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
								<span className="font-semibold">{t("hero.badge1")}</span>
								<span className="text-black/30 dark:text-white/30">&middot;</span>
								<span className="font-medium">{t("hero.badge2")}</span>
							</div>
						</NoiseBackground>
					</div>
				</BlurFade>

				<BlurFade delay={0.1} inView>
					<TypewriterEffect
						words={headlineWords}
						className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-medium text-left leading-tighter text-foreground justify-start"
					/>
				</BlurFade>

				<BlurFade delay={0.2} inView>
					<p className="mt-3 text-foreground/60 text-sm sm:text-lg max-w-3xl">
						{t("hero.subtitle")}
					</p>
				</BlurFade>

				<BlurFade delay={0.25} inView>
					<p className="mt-2 text-foreground/40 text-xs sm:text-sm max-w-2xl">
						{t("hero.subtitle2")}
					</p>
				</BlurFade>

				<BlurFade delay={0.3} inView>
					<div className="mt-6 flex items-center justify-start gap-2">
						{config.marketing.waitlistMode ? (
							<WaitlistForm />
						) : (
							<>
								<Button size="lg" variant="primary" asChild>
									<Link href="/auth/login">
										{t("hero.cta")}
										<ArrowRightIcon className="ml-2 size-4" />
									</Link>
								</Button>
								{config.docsLink && (
									<Button variant="ghost" size="lg" asChild>
										<LocaleLink href={config.docsLink}>
											{t("hero.docs")}
										</LocaleLink>
									</Button>
								)}
							</>
						)}
					</div>
				</BlurFade>

				<BlurFade delay={0.4} inView>
					<div className="mx-auto mt-12 lg:mt-16 xl:mt-24 lg:flex-1 rounded-4xl bg-primary/5 p-4 border shadow-xl">
					<Image
						src={heroImage}
						alt="Flowmail Dashboard"
						className="block rounded-xl dark:hidden"
						priority
					/>
					<Image
						src={heroImageDark}
						alt="Flowmail Dashboard"
						className="hidden rounded-xl dark:block"
						priority
					/>
					</div>
				</BlurFade>

				<BlurFade delay={0.5} inView>
					<div className="mt-12 lg:mt-16 text-center">
						<h5 className="font-semibold text-xs uppercase tracking-wider">
							<ColourfulText text={t("hero.tagline")} />
						</h5>
					</div>
				</BlurFade>
			</div>
		</div>
	);
}

