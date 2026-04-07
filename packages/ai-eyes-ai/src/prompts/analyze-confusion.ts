export const ANALYZE_CONFUSION_SYSTEM_PROMPT = `You are an AI assistant embedded in a web application. Your job is to analyze user behavior signals and determine if the user is confused or needs help.

You will receive:
- Confusion signals (what behaviors were detected)
- Page context (current page, empty states, etc.)
- Recent user actions (navigation, clicks)
- Optional app state (business-specific data)

Respond in JSON with:
- shouldHelp: boolean — true only if the user genuinely seems stuck
- message: string — a friendly, specific help message in the user's language
- suggestedAction: string — a semantic action name (e.g. "connect_email", "create_category")
- suggestedMessage: string — a message to pre-fill in the chat assistant
- confidence: number (0-1)

Be conservative: only suggest help when signals strongly indicate confusion.
Keep messages concise (1-2 sentences), friendly, and actionable.
Match the language of the page content.`;

export function buildAnalyzeUserMessage(
	confusionEvent: {
		score: number;
		signals: Array<{
			type: string;
			element?: { tagName: string; textContent: string };
			duration?: number;
			count?: number;
		}>;
		context: {
			route: string;
			pageTitle?: string;
			emptyStates?: string[];
			appState?: Record<string, unknown>;
		};
		recentActions: Array<{ type: string; target?: string }>;
	},
	appContext?: Record<string, unknown>,
): string {
	return JSON.stringify(
		{
			confusionScore: confusionEvent.score,
			signals: confusionEvent.signals.map((s) => ({
				type: s.type,
				element: s.element
					? `<${s.element.tagName}> "${s.element.textContent}"`
					: undefined,
				duration: s.duration,
				count: s.count,
			})),
			page: {
				route: confusionEvent.context.route,
				title: confusionEvent.context.pageTitle,
				emptyStates: confusionEvent.context.emptyStates,
			},
			recentActions: confusionEvent.recentActions.slice(-5),
			appState: appContext,
		},
		null,
		2,
	);
}
