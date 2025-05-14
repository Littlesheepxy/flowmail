import { Document } from "@shared/components/Document";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { PropsWithChildren } from "react";

export default async function LocaleLayout({ children }: PropsWithChildren) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<Document locale={locale}>
			<NextIntlClientProvider messages={messages}>
				{children}
			</NextIntlClientProvider>
		</Document>
	);
}
