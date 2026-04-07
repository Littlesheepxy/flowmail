"use client";

import { BlurFade } from "@repo/ui/components/blur-fade";
import { Button } from "@repo/ui/components/button";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { config } from "@/config";
import { WaitlistForm } from "./WaitlistForm";

export function BottomCTA() {
	const t = useTranslations();

	return (
		<section className="py-16 lg:py-24 bg-foreground text-background">
			<div className="container">
				<div className="mx-auto max-w-2xl text-center">
					<BlurFade inView>
						<h2 className="text-3xl font-medium lg:text-4xl xl:text-5xl">
							{t("bottomCta.title")}
						</h2>
					</BlurFade>

					<BlurFade delay={0.1} inView>
						<p className="mt-3 text-base text-background/60 lg:text-lg">
							{t("bottomCta.subtitle")}
						</p>
					</BlurFade>

					<BlurFade delay={0.2} inView>
						<div className="mt-8 flex justify-center">
							{config.marketing.waitlistMode ? (
								<WaitlistForm />
							) : (
								<Button size="lg" variant="secondary" asChild>
									<Link href="/auth/login">
										{t("hero.cta")}
										<ArrowRightIcon className="ml-2 size-4" />
									</Link>
								</Button>
							)}
						</div>
					</BlurFade>
				</div>
			</div>
		</section>
	);
}
