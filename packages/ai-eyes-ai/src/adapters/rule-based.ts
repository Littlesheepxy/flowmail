import type {
	AiAdapter,
	AnalyzeRequest,
	AnalyzeResponse,
	HelpRule,
} from "./types";

export function createRuleBasedAdapter(rules: HelpRule[]): AiAdapter {
	return {
		async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
			const { confusionEvent } = request;
			const route = confusionEvent.context.route;
			const signalTypes = confusionEvent.signals.map((s) => s.type);

			for (const rule of rules) {
				if (
					rule.signal &&
					!signalTypes.includes(rule.signal as never)
				) {
					continue;
				}

				if (rule.page) {
					if (
						typeof rule.page === "string" &&
						!route.includes(rule.page)
					) {
						continue;
					}
					if (rule.page instanceof RegExp && !rule.page.test(route)) {
						continue;
					}
				}

				if (rule.appState) {
					const appState = confusionEvent.context.appState ?? {};
					const matches = Object.entries(rule.appState).every(
						([key, value]) => appState[key] === value,
					);
					if (!matches) {
						continue;
					}
				}

				return {
					shouldHelp: true,
					message: rule.message,
					suggestedAction: rule.suggestedAction,
					suggestedMessage: rule.suggestedMessage,
					confidence: rule.confidence ?? 0.8,
				};
			}

			return {
				shouldHelp: false,
				message: "",
				confidence: 0,
			};
		},
	};
}
