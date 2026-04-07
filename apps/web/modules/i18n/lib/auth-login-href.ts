import type { Locale } from "@repo/i18n";

/** Use on marketing links so /auth/login picks up the same locale as the page. */
export function authLoginHref(
	locale: Locale,
	basePath = "/auth/login",
): string {
	return `${basePath}?locale=${encodeURIComponent(locale)}`;
}
