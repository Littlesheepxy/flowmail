"use client";

import { BlurFade } from "@repo/ui/components/blur-fade";
import { MagicCard } from "@repo/ui/components/magic-card";
import {
	DatabaseIcon,
	EyeOffIcon,
	FlagIcon,
	GlobeIcon,
	KeyRoundIcon,
	LockIcon,
	MailIcon,
	ScrollTextIcon,
	ServerIcon,
	ShieldCheckIcon,
	ShieldIcon,
	UserCheckIcon,
	GaugeIcon,
	FileOutputIcon,
	BrainIcon,
	SearchIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { config } from "@/config";

interface SecurityItem {
	titleKey: string;
	descriptionKey: string;
	icon: LucideIcon;
}

interface SecuritySectionData {
	titleKey: string;
	descriptionKey: string;
	icon: LucideIcon;
	items: SecurityItem[];
}

const sections: SecuritySectionData[] = [
	{
		titleKey: "dataSecurity",
		descriptionKey: "dataSecurity",
		icon: LockIcon,
		items: [
			{ titleKey: "dataSecurity.items.encryptionAtRest", descriptionKey: "dataSecurity.items.encryptionAtRest", icon: LockIcon },
			{ titleKey: "dataSecurity.items.encryptionInTransit", descriptionKey: "dataSecurity.items.encryptionInTransit", icon: GlobeIcon },
			{ titleKey: "dataSecurity.items.oauthSecurity", descriptionKey: "dataSecurity.items.oauthSecurity", icon: MailIcon },
		],
	},
	{
		titleKey: "accessControl",
		descriptionKey: "accessControl",
		icon: KeyRoundIcon,
		items: [
			{ titleKey: "accessControl.items.mfa", descriptionKey: "accessControl.items.mfa", icon: UserCheckIcon },
			{ titleKey: "accessControl.items.orgIsolation", descriptionKey: "accessControl.items.orgIsolation", icon: ShieldIcon },
			{ titleKey: "accessControl.items.apiTokens", descriptionKey: "accessControl.items.apiTokens", icon: KeyRoundIcon },
			{ titleKey: "accessControl.items.rateLimiting", descriptionKey: "accessControl.items.rateLimiting", icon: GaugeIcon },
		],
	},
	{
		titleKey: "aiPrivacy",
		descriptionKey: "aiPrivacy",
		icon: EyeOffIcon,
		items: [
			{ titleKey: "aiPrivacy.items.zeroTraining", descriptionKey: "aiPrivacy.items.zeroTraining", icon: BrainIcon },
			{ titleKey: "aiPrivacy.items.minimalAccess", descriptionKey: "aiPrivacy.items.minimalAccess", icon: EyeOffIcon },
			{ titleKey: "aiPrivacy.items.transparency", descriptionKey: "aiPrivacy.items.transparency", icon: SearchIcon },
		],
	},
	{
		titleKey: "compliance",
		descriptionKey: "compliance",
		icon: FlagIcon,
		items: [
			{ titleKey: "compliance.items.gdpr", descriptionKey: "compliance.items.gdpr", icon: FlagIcon },
			{ titleKey: "compliance.items.zeroTraining", descriptionKey: "compliance.items.zeroTraining", icon: EyeOffIcon },
			{ titleKey: "compliance.items.auditLog", descriptionKey: "compliance.items.auditLog", icon: ScrollTextIcon },
			{ titleKey: "compliance.items.dataExport", descriptionKey: "compliance.items.dataExport", icon: FileOutputIcon },
		],
	},
	{
		titleKey: "infrastructure",
		descriptionKey: "infrastructure",
		icon: ServerIcon,
		items: [
			{ titleKey: "infrastructure.items.hosting", descriptionKey: "infrastructure.items.hosting", icon: GlobeIcon },
			{ titleKey: "infrastructure.items.database", descriptionKey: "infrastructure.items.database", icon: DatabaseIcon },
			{ titleKey: "infrastructure.items.securityHeaders", descriptionKey: "infrastructure.items.securityHeaders", icon: ShieldCheckIcon },
		],
	},
];

const trustBadges = [
	{ key: "badge1", icon: LockIcon },
	{ key: "badge2", icon: KeyRoundIcon },
	{ key: "badge3", icon: ScrollTextIcon },
	{ key: "badge4", icon: EyeOffIcon },
	{ key: "badge5", icon: FlagIcon },
	{ key: "badge6", icon: GlobeIcon },
] as const;

export function SecurityPage() {
	const t = useTranslations("security");

	return (
		<div className="pt-24 pb-16">
			{/* Hero */}
			<section className="container">
				<BlurFade inView>
					<div className="mx-auto max-w-3xl text-center">
						<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-primary">
							<ShieldCheckIcon className="size-3.5" />
							{t("label")}
						</div>
						<h1 className="text-4xl font-medium lg:text-5xl xl:text-6xl">
							{t("page.hero.title")}
						</h1>
						<p className="mt-4 text-lg text-foreground/60">
							{t("page.hero.description")}
						</p>
					</div>
				</BlurFade>

				{/* Trust badges */}
				<BlurFade delay={0.1} inView>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
			</section>

			{/* Sections */}
			{sections.map((section, sectionIndex) => {
				const SectionIcon = section.icon;
				return (
					<section
						key={section.titleKey}
						className={`py-12 lg:py-16 ${sectionIndex % 2 === 1 ? "bg-muted/20" : ""}`}
					>
						<div className="container">
							<BlurFade delay={0.05} inView>
								<div className="mb-8 flex items-center gap-3 lg:mb-10">
									<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
										<SectionIcon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<h2 className="text-2xl font-medium lg:text-3xl">
											{t(`page.${section.titleKey}.title`)}
										</h2>
										<p className="text-sm text-foreground/50 mt-0.5">
											{t(`page.${section.descriptionKey}.description`)}
										</p>
									</div>
								</div>
							</BlurFade>

							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{section.items.map((item, i) => {
									const Icon = item.icon;
									return (
										<BlurFade
											key={item.titleKey}
											delay={0.05 + i * 0.05}
											inView
										>
											<MagicCard className="h-full rounded-2xl p-5 lg:p-6">
												<div>
													<div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-foreground/5">
														<Icon className="size-4 text-foreground/60" />
													</div>
													<h3 className="font-medium text-base">
														{t(`page.${item.titleKey}.title`)}
													</h3>
													<p className="mt-1.5 text-sm leading-relaxed text-foreground/50">
														{t(`page.${item.descriptionKey}.description`)}
													</p>
												</div>
											</MagicCard>
										</BlurFade>
									);
								})}
							</div>
						</div>
					</section>
				);
			})}

			{/* CTA */}
			<section className="py-12 lg:py-16">
				<div className="container">
					<BlurFade inView>
						<div className="mx-auto max-w-xl text-center">
							<h2 className="text-2xl font-medium lg:text-3xl">
								{t("page.cta.title")}
							</h2>
							<p className="mt-3 text-foreground/60">
								{t("page.cta.description")}
							</p>
							<a
								href={`mailto:security@${config.appUrl?.replace(/https?:\/\//, "") || "flowmail.app"}`}
								className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
							>
								<MailIcon className="size-4" />
								{t("page.cta.email")}
							</a>
						</div>
					</BlurFade>
				</div>
			</section>
		</div>
	);
}
