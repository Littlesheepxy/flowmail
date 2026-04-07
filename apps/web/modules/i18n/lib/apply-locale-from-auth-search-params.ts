import "server-only";

import { routing } from "@i18n/routing";
import type { Locale } from "@repo/i18n";
import { redirect } from "next/navigation";
import { setLocaleCookie } from "./locale-cookie";

const validLocales = new Set<string>(routing.locales);

/**
 * Auth routes skip next-intl middleware. When marketing links include
 * `?locale=zh`, persist the cookie and redirect to a clean URL.
 */
export async function applyLocaleFromAuthSearchParams(
	pathname: "/auth/login" | "/auth/signup",
	searchParams: Record<string, string | string[] | undefined>,
): Promise<void> {
	const raw = searchParams.locale;
	if (typeof raw !== "string" || !validLocales.has(raw)) {
		return;
	}

	await setLocaleCookie(raw as Locale);

	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(searchParams)) {
		if (key === "locale" || typeof value !== "string") {
			continue;
		}
		params.set(key, value);
	}
	const query = params.toString();
	redirect(query ? `${pathname}?${query}` : pathname);
}
