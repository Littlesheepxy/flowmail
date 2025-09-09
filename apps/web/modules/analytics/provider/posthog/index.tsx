"use client";

// @ts-expect-error package is not installed per default
import posthog from "posthog-js";
import { useEffect } from "react";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY as string;

export function AnalyticsScript() {
	useEffect(() => {
		if (!posthogKey) {
			return;
		}

		posthog.init(posthogKey, {
			// use eu.i.posthog.com for european users
			api_host: "https://i.posthog.com",
			person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
		});
	}, []);

	return null;
}

export function useAnalytics() {
	const trackEvent = (event: string, data?: Record<string, unknown>) => {
		if (!posthogKey) {
			return;
		}

		posthog.capture(event, data);
	};

	return {
		trackEvent,
	};
}
