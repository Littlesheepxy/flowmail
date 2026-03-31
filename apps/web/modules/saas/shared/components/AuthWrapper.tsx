import { config } from "@repo/i18n/config";
import { cn, Logo } from "@repo/ui";
import { Footer } from "@saas/shared/components/Footer";
import { ColorModeToggle } from "@shared/components/ColorModeToggle";
import { LocaleSwitch } from "@shared/components/LocaleSwitch";
import {
	BotIcon,
	InboxIcon,
	WorkflowIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type PropsWithChildren, Suspense } from "react";

const featureIcons = [InboxIcon, WorkflowIcon, BotIcon];

export function AuthWrapper({
	children,
	contentClass,
}: PropsWithChildren<{ contentClass?: string }>) {
	const t = useTranslations("auth.branding");

	const features = [
		{ icon: featureIcons[0], text: t("feature1") },
		{ icon: featureIcons[1], text: t("feature2") },
		{ icon: featureIcons[2], text: t("feature3") },
	];

	return (
		<div className="flex min-h-screen w-full">
			{/* Left: gradient branding panel */}
			<div className="relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden bg-[#0a0a0f]">
				{/* Colorful misty blobs */}
				<div className="absolute top-[-10%] left-[-10%] size-[55%] rounded-full bg-violet-500/30 blur-[80px]" />
				<div className="absolute top-[20%] right-[-5%] size-[45%] rounded-full bg-sky-400/25 blur-[70px]" />
				<div className="absolute top-[45%] left-[10%] size-[50%] rounded-full bg-fuchsia-500/25 blur-[80px]" />
				<div className="absolute bottom-[5%] right-[5%] size-[45%] rounded-full bg-emerald-400/20 blur-[70px]" />
				<div className="absolute bottom-[25%] left-[30%] size-[35%] rounded-full bg-rose-500/20 blur-[60px]" />
				<div className="absolute top-[10%] left-[40%] size-[30%] rounded-full bg-amber-400/15 blur-[60px]" />

				{/* Logo */}
				<div className="relative z-10 p-10">
					<Link href="/">
						<Logo className="brightness-0 invert" />
					</Link>
				</div>

				{/* Center content */}
				<div className="relative z-10 flex flex-1 flex-col justify-center px-10 pb-8">
					<h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
						{t("headline")}
					</h1>
					<p className="mt-4 text-white/50 text-base max-w-sm">
						{t("subtitle")}
					</p>

					<ul className="mt-8 flex flex-col gap-3">
						{features.map((f) => (
							<li key={f.text} className="flex items-center gap-3 text-white/70">
								<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
									<f.icon className="size-3.5 text-white/80" />
								</span>
								<span className="text-sm">{f.text}</span>
							</li>
						))}
					</ul>
				</div>

				{/* Large brand text at bottom */}
				<div className="relative z-10 overflow-hidden px-8">
					<p
						aria-hidden="true"
						className="select-none pointer-events-none text-[clamp(4rem,8vw,8rem)] font-bold leading-none text-white/5"
					>
						Flowmail
					</p>
				</div>
			</div>

			{/* Right: form panel */}
			<div className="flex w-full lg:w-1/2 flex-col py-6">
				{/* Top bar */}
				<div className="px-6 sm:px-10">
					<div className="flex items-center justify-between">
						<Link href="/" className="block lg:hidden">
							<Logo />
						</Link>

						<div className="ml-auto flex items-center gap-2">
							{Object.keys(config.locales).length > 1 && (
								<Suspense>
									<LocaleSwitch withLocaleInUrl={false} />
								</Suspense>
							)}
							<ColorModeToggle />
						</div>
					</div>
				</div>

				{/* Form */}
				<div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
					<main
						className={cn(
							"w-full max-w-md rounded-3xl bg-card p-6 border lg:p-8",
							contentClass,
						)}
					>
						{children}
					</main>
				</div>

				<Footer />
			</div>
		</div>
	);
}
