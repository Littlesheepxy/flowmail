"use client";

import Script from "next/script";

const pirschCode = process.env.NEXT_PUBLIC_PIRSCH_CODE as string;

export function AnalyticsScript() {
	return (
		<Script
			defer
			type="text/javascript"
			src="https://api.pirsch.io/pirsch-extended.js"
			id="pirschextendedjs"
			data-code={pirschCode}
		/>
	);
}

export function useAnalytics() {
	const trackEvent = (event: string, data?: Record<string, unknown>) => {
		if (typeof window === "undefined" || !(window as any).pirsch) {
			return;
		}

		(window as any).pirsch(event, {
			meta: data,
		});
	};

	return {
		trackEvent,
	};
}
