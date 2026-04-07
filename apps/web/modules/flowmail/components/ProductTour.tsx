"use client";

import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import "../styles/product-tour.css";

export function ProductTour() {
	const t = useTranslations("productTour");
	const { activeOrganization } = useActiveOrganization();
	const queryClient = useQueryClient();
	const tourStartedRef = useRef(false);

	const orgId = activeOrganization?.id ?? "";

	const { data: guideStatus } = useQuery({
		...orpc.setupGuide.getStatus.queryOptions({
			input: { organizationId: orgId },
		}),
		enabled: !!orgId,
	});

	const markStepMutation = useMutation(
		orpc.setupGuide.markStep.mutationOptions(),
	);

	const handleTourComplete = useCallback(() => {
		if (!orgId) {
			return;
		}
		markStepMutation.mutate(
			{ organizationId: orgId, step: "tourCompleted" },
			{
				onSuccess: () => {
					queryClient.invalidateQueries({
						queryKey: orpc.setupGuide.getStatus.queryOptions({
							input: { organizationId: orgId },
						}).queryKey,
					});
				},
			},
		);
	}, [orgId, markStepMutation, queryClient]);

	const tourCompleted = guideStatus?.tourCompleted;
	const shouldStart = !!orgId && guideStatus !== undefined && !tourCompleted;

	useEffect(() => {
		if (!shouldStart) {
			return;
		}
		if (tourStartedRef.current) {
			return;
		}
		tourStartedRef.current = true;

		const timeout = setTimeout(async () => {
			const targetEl = document.querySelector('[data-tour="inbox"]');
			if (!targetEl) {
				tourStartedRef.current = false;
				return;
			}

			const { driver } = await import("driver.js");
			// @ts-expect-error CSS module import has no type declarations
			await import("driver.js/dist/driver.css");

			const driverObj = driver({
				showProgress: true,
				animate: true,
				smoothScroll: true,
				allowClose: true,
				overlayColor: "rgb(0 0 0 / 0.5)",
				stagePadding: 6,
				stageRadius: 10,
				popoverClass: "flowmail-tour-popover",
				nextBtnText: t("next"),
				prevBtnText: t("prev"),
				doneBtnText: t("done"),
				progressText: "{{current}} / {{total}}",
				popoverOffset: 16,
				steps: [
					{
						element: '[data-tour="inbox"]',
						popover: {
							title: t("inbox.title"),
							description: t("inbox.description"),
							side: "right",
							align: "center",
						},
					},
					{
						element: '[data-tour="connections"]',
						popover: {
							title: t("connections.title"),
							description: t("connections.description"),
							side: "right",
							align: "center",
						},
					},
					{
						element: '[data-tour="categories"]',
						popover: {
							title: t("categories.title"),
							description: t("categories.description"),
							side: "right",
							align: "center",
						},
					},
					{
						element: '[data-tour="notifications"]',
						popover: {
							title: t("notifications.title"),
							description: t("notifications.description"),
							side: "top",
							align: "center",
						},
					},
				],
				onDestroyStarted: () => {
					driverObj.destroy();
				},
				onDestroyed: () => {
					handleTourComplete();
				},
			});

			driverObj.drive();
		}, 1000);

		return () => clearTimeout(timeout);
	}, [shouldStart, t, handleTourComplete]);

	return null;
}
