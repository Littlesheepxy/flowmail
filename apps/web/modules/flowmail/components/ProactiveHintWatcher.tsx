"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useProactiveHints } from "../hooks/use-proactive-hints";

/**
 * Watches the current page and user state to surface proactive help hints.
 * Must be rendered inside AiEyesProvider.
 */
export function ProactiveHintWatcher() {
	const pathname = usePathname();
	const [pageState, setPageState] = useState({
		hasEntities: false,
		hasConnections: false,
		isEmptyInbox: false,
		entityCount: 0,
		connectionCount: 0,
		isDemoMode: false,
		isPlatformOAuthOpen: false,
	});

	useEffect(() => {
		const interval = setInterval(() => {
			const emptyStates = document.querySelectorAll(
				'[data-empty-state], [data-inbox-empty="true"]',
			);
			const entityCards = document.querySelectorAll(
				'[data-entity-card], [data-guide="inbox-entity-list"] [role="button"]',
			);
			const connectionItems = document.querySelectorAll(
				'[data-connection-item]',
			);
			const demoBanner = document.querySelector('[data-demo-banner]');
			const platformOAuth = document.querySelector('[data-platform-oauth-open]');

			setPageState({
				hasEntities: entityCards.length > 0,
				hasConnections: connectionItems.length > 0,
				isEmptyInbox:
					emptyStates.length > 0 ||
					(pathname.includes("/inbox") && entityCards.length === 0),
				entityCount: entityCards.length,
				connectionCount: connectionItems.length,
				isDemoMode: !!demoBanner,
				isPlatformOAuthOpen: !!platformOAuth,
			});
		}, 2000);

		return () => clearInterval(interval);
	}, [pathname]);

	useProactiveHints(pageState);

	return null;
}
