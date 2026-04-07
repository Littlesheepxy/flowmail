"use client";

import { BlurFade } from "@repo/ui/components/blur-fade";
import { MailIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface Platform {
	name: string;
	icon?: string;
	textLogo?: string;
}

const platforms: Platform[] = [
	{ name: "Gmail", icon: "/icons/integrations/gmail.svg" },
	{ name: "Outlook", icon: "/icons/integrations/outlook.svg" },
	{ name: "Feishu / Lark", icon: "/icons/integrations/feishu.svg" },
	{ name: "QQ Mail", textLogo: "QQ" },
	{ name: "163 Mail", textLogo: "163" },
	{ name: "IMAP" },
];

export function PlatformLogos() {
	const t = useTranslations("platformLogos");

	return (
		<section className="py-8 lg:py-12 border-y border-border/40 bg-muted/20">
			<div className="container">
				<BlurFade inView>
					<p className="text-center text-xs font-medium uppercase tracking-wider text-foreground/40 mb-6">
						{t("title")}
					</p>
					<div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
						{platforms.map((platform) => (
							<div
								key={platform.name}
								className="group flex flex-col items-center gap-2 transition-opacity opacity-50 hover:opacity-100"
							>
								<div className="flex h-10 w-10 items-center justify-center">
									{platform.icon ? (
										<Image
											src={platform.icon}
											alt={platform.name}
											width={32}
											height={32}
											className="h-8 w-8 grayscale transition-all group-hover:grayscale-0"
										/>
									) : platform.textLogo ? (
										<span className="text-lg font-bold text-foreground/60 transition-colors group-hover:text-primary">
											{platform.textLogo}
										</span>
									) : (
										<MailIcon className="h-7 w-7 text-foreground/50 transition-colors group-hover:text-primary" />
									)}
								</div>
								<span className="text-[10px] font-medium text-foreground/40 transition-colors group-hover:text-foreground/70">
									{platform.name}
								</span>
							</div>
						))}
					</div>
				</BlurFade>
			</div>
		</section>
	);
}
