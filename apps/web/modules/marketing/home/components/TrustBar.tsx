"use client";

import { BlurFade } from "@repo/ui/components/blur-fade";
import { LockIcon, ShieldCheckIcon, FlagIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const badges = [
	{ key: "badge1", icon: ShieldCheckIcon },
	{ key: "badge2", icon: FlagIcon },
	{ key: "badge3", icon: LockIcon },
	{ key: "badge4", icon: EyeOffIcon },
] as const;

export function TrustBar() {
	const t = useTranslations("security");

	return (
		<section className="py-6 lg:py-8 border-b border-border/40">
			<div className="container">
				<BlurFade inView delay={0.1}>
					<div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
						{badges.map((badge) => (
							<div
								key={badge.key}
								className="flex items-center gap-1.5 text-xs text-foreground/40 font-medium"
							>
								<badge.icon className="size-3.5" />
								{t(badge.key)}
							</div>
						))}
					</div>
				</BlurFade>
			</div>
		</section>
	);
}
