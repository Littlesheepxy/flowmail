"use client";

export function AnalyticsScript() {
	// return your script here
	return null;
}

export function useAnalytics() {
	const trackEvent = (event: string, data: Record<string, unknown>) => {
		// call your analytics service to track a custom event here
		console.info("tracking event", event, data);
	};

	return {
		trackEvent,
	};
}
