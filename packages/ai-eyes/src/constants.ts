import type { SignalType } from "./types";

export const DEFAULT_SIGNAL_WEIGHTS: Record<SignalType, number> = {
	idle: 15,
	hover_hesitation: 20,
	rage_click: 30,
	scroll_bounce: 10,
	long_page_stay: 15,
	empty_state_stare: 25,
	page_stall: 35,
};

export const DEFAULT_SENSOR_CONFIG = {
	idleThreshold: 3000,
	hoverHesitationCount: 2,
	rageClickWindow: 2000,
	rageClickCount: 3,
	scrollBounceWindow: 3000,
	scrollBounceCount: 4,
	emptyStateDelay: 5000,
	longPageStayDelay: 60000,
	pageStallDelay: 8000,
	confusionThreshold: 35,
	cooldownMs: 15000,
	windowMs: 30000,
} as const;

export const REPEAT_DECAY = 0.5;
export const MAX_RECENT_ACTIONS = 10;
export const MAX_SIGNALS_IN_WINDOW = 20;
