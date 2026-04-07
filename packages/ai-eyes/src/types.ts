/** Signal types detected by the behavior sensor */
export type SignalType =
	| "idle"
	| "hover_hesitation"
	| "rage_click"
	| "scroll_bounce"
	| "long_page_stay"
	| "empty_state_stare";

export interface ConfusionSignal {
	type: SignalType;
	element?: {
		tagName: string;
		textContent: string;
		ariaLabel?: string;
		dataAttributes: Record<string, string>;
		rect: { x: number; y: number; width: number; height: number };
	};
	duration?: number;
	count?: number;
	timestamp: number;
}

export interface PageContext {
	route: string;
	pageTitle?: string;
	visibleText?: string[];
	emptyStates?: string[];
	interactiveElements?: number;
	appState?: Record<string, unknown>;
}

export interface ConfusionEvent {
	score: number;
	signals: ConfusionSignal[];
	context: PageContext;
	recentActions: UserAction[];
	timestamp: number;
}

export type ActionType =
	| "click"
	| "navigate"
	| "scroll"
	| "hover"
	| "input"
	| "focus"
	| "blur"
	| "keypress"
	| "select"
	| "resize"
	| "visibility_change"
	| "error";

export interface UserAction {
	type: ActionType;
	/** Semantic module name, resolved from closest `data-module` ancestor. */
	module?: string;
	target?: string;
	route?: string;
	timestamp: number;
	detail?: Record<string, unknown>;
}

export interface RecorderConfig {
	/** Rolling window duration in ms. Default 30000 (30s). */
	durationMs?: number;
	/** Max entries to keep even within the window. Default 200. */
	maxEntries?: number;
	/** Throttle interval for high-frequency events (mousemove/scroll) in ms. Default 500. */
	throttleMs?: number;
	/** Record navigation (popstate/pushState). Default true. */
	trackNavigation?: boolean;
	/** Record input focus/blur. Default true. */
	trackFocus?: boolean;
	/** Record keyboard activity (key count, not content — privacy safe). Default true. */
	trackKeyboard?: boolean;
	/** Record viewport resize. Default false. */
	trackResize?: boolean;
	/** Record JS errors. Default true. */
	trackErrors?: boolean;
}

export interface SensorConfig {
	idleThreshold?: number;
	hoverHesitationCount?: number;
	rageClickWindow?: number;
	rageClickCount?: number;
	scrollBounceWindow?: number;
	scrollBounceCount?: number;
	emptyStateDelay?: number;
	longPageStayDelay?: number;
	signalWeights?: Partial<Record<SignalType, number>>;
	confusionThreshold?: number;
	cooldownMs?: number;
	windowMs?: number;
}

export interface AiEyesCoreConfig {
	sensor?: SensorConfig;
	recorder?: RecorderConfig;
	enabled?: boolean;
}

export interface HelpSuggestion {
	shouldHelp: boolean;
	message: string;
	suggestedAction?: string;
	suggestedMessage?: string;
	confidence: number;
}
