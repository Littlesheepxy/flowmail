"use client";

import { LocaleLink } from "@i18n/routing";
import { Logo } from "@repo/ui";
import { useTranslations } from "next-intl";
import { config } from "@/config";

export function Footer() {
	const t = useTranslations();

	return (
		<footer className="border-t text-foreground/60 text-sm">
			<div className="container grid grid-cols-1 gap-6 py-8 lg:grid-cols-3">
				<div>
					<Logo className="opacity-70 grayscale" />
					<p className="mt-3 text-sm opacity-70">
						&copy; {new Date().getFullYear()} {config.appName}.
					</p>
				</div>

				<div className="flex flex-col gap-2">
					<LocaleLink href="/blog" className="block">
						{t("common.footer.blog")}
					</LocaleLink>

					<a href="#features" className="block">
						{t("common.footer.features")}
					</a>

					<a href="/#pricing" className="block">
						{t("common.footer.pricing")}
					</a>
				</div>

				<div className="flex flex-col gap-2">
					<LocaleLink href="/legal/privacy-policy" className="block">
						{t("common.footer.privacy")}
					</LocaleLink>

					<LocaleLink href="/legal/terms" className="block">
						{t("common.footer.terms")}
					</LocaleLink>
				</div>
			</div>
			<div className="overflow-hidden">
				<p
					aria-hidden="true"
					className="text-center text-[clamp(4rem,18vw,14rem)] font-bold leading-none select-none pointer-events-none bg-clip-text text-transparent bg-linear-to-b from-foreground/15 to-transparent pb-2 pt-4"
				>
					{config.appName}
				</p>
			</div>
		</footer>
	);
}
