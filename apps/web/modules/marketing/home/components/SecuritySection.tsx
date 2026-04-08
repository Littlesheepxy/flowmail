"use client";

import { LocaleLink } from "@i18n/routing";
import { BlurFade } from "@repo/ui/components/blur-fade";
import {
	ArrowRightIcon,
	EyeOffIcon,
	FlagIcon,
	GlobeIcon,
	KeyRoundIcon,
	LockIcon,
	ScrollTextIcon,
	ShieldCheckIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

const trustBadges = [
	{ key: "badge1", icon: LockIcon },
	{ key: "badge2", icon: KeyRoundIcon },
	{ key: "badge3", icon: ScrollTextIcon },
	{ key: "badge4", icon: EyeOffIcon },
	{ key: "badge5", icon: FlagIcon },
	{ key: "badge6", icon: GlobeIcon },
] as const;

export function SecuritySection() {
	const t = useTranslations("security");

	return (
		<section id="security" className="py-12 lg:py-16">
			<div className="container">
				<BlurFade inView>
					<div className="mx-auto max-w-2xl text-center">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-primary">
							<ShieldCheckIcon className="size-3.5" />
							{t("label")}
						</div>
						<h2 className="text-2xl font-medium lg:text-3xl">
							{t("title")}
						</h2>
						<p className="mt-2 text-sm text-foreground/60 lg:text-base">
							{t("description")}
						</p>
					</div>
				</BlurFade>

				<BlurFade delay={0.15} inView>
					<div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-3">
						{trustBadges.map((badge) => (
							<div
								key={badge.key}
								className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/50 px-4 py-2 text-sm font-medium text-foreground/70"
							>
								<badge.icon className="size-3.5 text-green-500" />
								{t(badge.key)}
							</div>
						))}
					</div>
				</BlurFade>

				<BlurFade delay={0.2} inView>
					<div className="mt-6 text-center">
						<LocaleLink
							href="/security"
							className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
						>
							Learn more
							<ArrowRightIcon className="size-3.5" />
						</LocaleLink>
					</div>
				</BlurFade>
			</div>
		</section>
	);
}
