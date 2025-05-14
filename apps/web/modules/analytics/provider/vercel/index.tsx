"use client";

// @ts-expect-error package is not installed per default
import { track } from "@vercel/analytics";
// @ts-expect-error package is not installed per default
import { Analytics } from "@vercel/analytics/react";

export function AnalyticsScript() {
	return <Analytics />;
}

export function useAnalytics() {
	const trackEvent = (event: string, data?: Record<string, unknown>) => {
		track(event, data);
	};

	return {
		trackEvent,
	};
}
