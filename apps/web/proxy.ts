import { routing } from "@i18n/routing";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { withQuery } from "ufo";
import { config as appConfig } from "@/config";

const intlMiddleware = createMiddleware(routing);

export default async function proxy(req: NextRequest) {
	const { pathname, origin } = req.nextUrl;

	const sessionCookie = getSessionCookie(req);

	if (pathname.startsWith("/app")) {
		const response = NextResponse.next();

		if (!appConfig.saas.enabled) {
			return NextResponse.redirect(new URL("/", origin));
		}

		if (!sessionCookie) {
			const localeCookie = req.cookies.get("NEXT_LOCALE")?.value;
			const loginQuery: Record<string, string> = { redirectTo: pathname };
			if (
				localeCookie &&
				routing.locales.includes(
					localeCookie as (typeof routing.locales)[number],
				)
			) {
				loginQuery.locale = localeCookie;
			}
			return NextResponse.redirect(
				new URL(withQuery("/auth/login", loginQuery), origin),
			);
		}

		return response;
	}

	if (pathname.startsWith("/auth")) {
		if (!appConfig.saas.enabled) {
			return NextResponse.redirect(new URL("/", origin));
		}

		const localeParam = req.nextUrl.searchParams.get("locale");
		if (
			localeParam &&
			routing.locales.includes(
				localeParam as (typeof routing.locales)[number],
			)
		) {
			const url = req.nextUrl.clone();
			url.searchParams.delete("locale");
			const response = NextResponse.redirect(url);
			response.cookies.set("NEXT_LOCALE", localeParam);
			return response;
		}

		return NextResponse.next();
	}

	const pathsWithoutLocale = [
		"/onboarding",
		"/new-organization",
		"/choose-plan",
		"/organization-invitation",
		"/call",
		"/ph",
	];

	if (pathsWithoutLocale.some((path) => pathname.startsWith(path))) {
		return NextResponse.next();
	}

	if (!appConfig.marketing.enabled) {
		return NextResponse.redirect(new URL("/app", origin));
	}

	return intlMiddleware(req);
}

export const config = {
	matcher: [
		"/((?!api|image-proxy|images|icons|fonts|sounds|_next/static|_next/image|favicon\\.ico|favicon-.*\\.png|apple-touch-icon\\.png|icon-.*\\.png|icon\\.png|logo.*\\.png|sitemap\\.xml|robots\\.txt).*)",
	],
};
