import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { Document } from "@shared/components/Document";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { PropsWithChildren } from "react";

export default async function AuthLayout({ children }: PropsWithChildren) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<Document locale={locale}>
			<NextIntlClientProvider messages={messages}>
				<SessionProvider>
					<AuthWrapper>{children}</AuthWrapper>
				</SessionProvider>
			</NextIntlClientProvider>
		</Document>
	);
}
