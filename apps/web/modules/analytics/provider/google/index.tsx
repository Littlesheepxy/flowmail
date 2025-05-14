"use client";

import Script from "next/script";

const googleTagId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID as string;

export function AnalyticsScript() {
	return (
		<Script
			async
			src={`https://www.googletagmanager.com/gtag/js?id=${googleTagId}`}
			onLoad={() => {
				if (typeof window === "undefined") {
					return;
				}

				(window as any).dataLayer = (window as any).dataLayer || [];

				function gtag(...rest: any[]) {
					(window as any).dataLayer.push(...rest);
				}
				gtag("js", new Date());
				gtag("config", googleTagId);
			}}
		/>
	);
}

export function useAnalytics() {
	const trackEvent = (event: string, data?: Record<string, unknown>) => {
		if (typeof window === "undefined" || !(window as any).gta) {
			return;
		}

		(window as any).gta("event", event, data);
	};

	return {
		trackEvent,
	};
}
