import { os } from "@orpc/server";
import { getCookie } from "@orpc/server/helpers";
import type { Locale } from "@repo/i18n";
import { config } from "@repo/i18n/config";

export const localeMiddleware = os
	.$context<{
		headers: Headers;
	}>()
	.middleware(async ({ context, next }) => {
		const locale =
			(getCookie(context.headers, config.localeCookieName) as Locale) ??
			config.defaultLocale;

		return await next({
			context: {
				locale,
			},
		});
	});
