import type { PageContext } from "../types";

export class ContextCollector {
	private appState: Record<string, unknown> = {};

	setAppState(state: Record<string, unknown>): void {
		this.appState = { ...state };
	}

	updateAppState(partial: Record<string, unknown>): void {
		Object.assign(this.appState, partial);
	}

	collect(): PageContext {
		const route =
			typeof window !== "undefined" ? window.location.pathname : "/";

		const h1 = document.querySelector("h1");
		const pageTitle =
			h1?.textContent?.trim() ?? document.title ?? undefined;

		const emptyStates: string[] = [];
		const emptyEls = document.querySelectorAll(
			'[data-empty-state], .empty-state, [aria-label*="empty"]',
		);
		for (const el of emptyEls) {
			const text = el.textContent?.trim();
			if (text) {
				emptyStates.push(text.slice(0, 100));
			}
		}

		const interactiveElements = document.querySelectorAll(
			"a, button, input, select, textarea, [role=button], [role=link]",
		).length;

		return {
			route,
			pageTitle,
			emptyStates: emptyStates.length > 0 ? emptyStates : undefined,
			interactiveElements,
			appState:
				Object.keys(this.appState).length > 0
					? { ...this.appState }
					: undefined,
		};
	}
}
