import { os } from "@orpc/server";
import { getCookie } from "@orpc/server/helpers";
import { config } from "@repo/config";
import type { Locale } from "@repo/i18n";

export const localeMiddleware = os
	.$context<{
		headers: Headers;
	}>()
	.middleware(async ({ context, next }) => {
		const locale =
			(getCookie(
				context.headers,
				config.i18n.localeCookieName,
			) as Locale) ?? config.i18n.defaultLocale;

		return await next({
			context: {
				locale,
			},
		});
	});
