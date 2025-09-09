import { Footer } from "@marketing/shared/components/Footer";
import { NavBar } from "@marketing/shared/components/NavBar";
import { config } from "@repo/config";
import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { Document } from "@shared/components/Document";
import { NextProvider as FumadocsNextProvider } from "fumadocs-core/framework/next";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";

const locales = Object.keys(config.i18n.locales);

export function generateStaticParams() {
	return locales.map((locale) => ({ locale }));
}

export default async function MarketingLayout({
	children,
	params,
}: PropsWithChildren<{ params: Promise<{ locale: string }> }>) {
	const { locale } = await params;

	setRequestLocale(locale);

	if (!locales.includes(locale as any)) {
		notFound();
	}

	const messages = await getMessages();

	return (
		<Document locale={locale}>
			<FumadocsNextProvider>
				<FumadocsRootProvider
					search={{
						enabled: true,
						options: {
							api: "/api/docs-search",
						},
					}}
					i18n={{
						locale,
					}}
				>
					<NextIntlClientProvider locale={locale} messages={messages}>
						<SessionProvider>
							<NavBar />
							<main className="min-h-screen">{children}</main>
							<Footer />
						</SessionProvider>
					</NextIntlClientProvider>
				</FumadocsRootProvider>
			</FumadocsNextProvider>
		</Document>
	);
}
