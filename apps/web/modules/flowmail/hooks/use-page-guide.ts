"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface GuideStep {
	element: string;
	title: string;
	description: string;
	side?: "top" | "bottom" | "left" | "right";
}

export function usePageGuide(
	guideKey: string,
	steps: GuideStep[],
	opts?: { delay?: number },
) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const startedRef = useRef(false);
	const stepsRef = useRef(steps);
	stepsRef.current = steps;

	useEffect(() => {
		const guideParam = searchParams.get("guide");
		if (guideParam !== guideKey) {
			return;
		}
		if (startedRef.current) {
			return;
		}
		if (stepsRef.current.length === 0) {
			return;
		}
		startedRef.current = true;

		const delay = opts?.delay ?? 800;

		const timeout = setTimeout(async () => {
			const firstEl = document.querySelector(stepsRef.current[0].element);
			if (!firstEl) {
				startedRef.current = false;
				return;
			}

			const { driver } = await import("driver.js");
			// @ts-expect-error CSS module import has no type declarations
			await import("driver.js/dist/driver.css");
			await import("../styles/product-tour.css");

			const driverObj = driver({
				showProgress: stepsRef.current.length > 1,
				animate: true,
				smoothScroll: true,
				allowClose: true,
				overlayColor: "rgb(0 0 0 / 0.6)",
				stagePadding: 10,
				stageRadius: 10,
				popoverOffset: 16,
				popoverClass: "flowmail-tour-popover",
				nextBtnText: "下一步",
				prevBtnText: "上一步",
				doneBtnText: "知道了",
				steps: stepsRef.current.map((s) => ({
					element: s.element,
					popover: {
						title: s.title,
						description: s.description.replace(/\n/g, "<br>"),
						side: s.side ?? "bottom",
						align: "center" as const,
					},
				})),
				onDestroyed: () => {
					const url = new URL(window.location.href);
					url.searchParams.delete("guide");
					router.replace(url.pathname + url.search, {
						scroll: false,
					});
				},
			});

			driverObj.drive();
		}, delay);

		return () => clearTimeout(timeout);
	}, [searchParams, guideKey, router, opts?.delay]);
}
