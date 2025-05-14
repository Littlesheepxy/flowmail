import { Footer } from "@marketing/shared/components/Footer";
import { NavBar } from "@marketing/shared/components/NavBar";
import { config } from "@repo/config";
import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { Document } from "@shared/components/Document";
import { I18nProvider as FumadocsI18nProvider } from "fumadocs-ui/i18n";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
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
			<FumadocsI18nProvider locale={locale}>
				<FumadocsRootProvider
					search={{
						enabled: true,
						options: {
							api: "/api/docs-search",
						},
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
			</FumadocsI18nProvider>
		</Document>
	);
}
