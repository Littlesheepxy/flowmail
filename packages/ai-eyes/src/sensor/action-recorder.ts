import type { RecorderConfig, UserAction } from "../types";

const DEFAULT_DURATION_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_THROTTLE_MS = 500;

/**
 * Walk up the DOM tree from `el` to find the closest ancestor
 * (or self) with a `data-module` attribute.
 * Also collects `data-section` for sub-module granularity.
 */
function resolveModuleContext(el: Element): {
	module?: string;
	section?: string;
} {
	let current: Element | null = el;
	let section: string | undefined;
	let module: string | undefined;

	while (current && current !== document.documentElement) {
		if (!section) {
			const sec = current.getAttribute("data-section");
			if (sec) {
				section = sec;
			}
		}
		if (!module) {
			const mod = current.getAttribute("data-module");
			if (mod) {
				module = mod;
			}
		}
		if (module) {
			break;
		}
		current = current.parentElement;
	}

	return { module, section };
}

/**
 * Check if an element or any of its ancestors has `data-ai-eyes-ignore`.
 * Used to exclude sensitive areas (password fields, payment forms, etc.).
 */
function isIgnored(el: Element): boolean {
	let current: Element | null = el;
	while (current && current !== document.documentElement) {
		if (current.hasAttribute("data-ai-eyes-ignore")) {
			return true;
		}
		current = current.parentElement;
	}
	return false;
}

/**
 * ActionRecorder — a rolling dashcam-style buffer for user actions.
 *
 * - Continuously records user interactions (click, navigate, scroll, input, etc.)
 * - Auto-evicts entries older than `durationMs`
 * - Caps total entries at `maxEntries`
 * - High-frequency events (scroll, mousemove) are throttled
 * - Keyboard recording is privacy-safe: only counts keystrokes, never captures content
 * - Duration is configurable at construction or runtime via `setDuration()`
 */
export class ActionRecorder {
	private buffer: UserAction[] = [];
	private durationMs: number;
	private maxEntries: number;
	private throttleMs: number;
	private trackNavigation: boolean;
	private trackFocus: boolean;
	private trackKeyboard: boolean;
	private trackResize: boolean;
	private trackErrors: boolean;

	private cleanup: (() => void)[] = [];
	private started = false;
	private lastThrottled = new Map<string, number>();
	private gcTimer: ReturnType<typeof setInterval> | null = null;

	constructor(config?: RecorderConfig) {
		this.durationMs = config?.durationMs ?? DEFAULT_DURATION_MS;
		this.maxEntries = config?.maxEntries ?? DEFAULT_MAX_ENTRIES;
		this.throttleMs = config?.throttleMs ?? DEFAULT_THROTTLE_MS;
		this.trackNavigation = config?.trackNavigation !== false;
		this.trackFocus = config?.trackFocus !== false;
		this.trackKeyboard = config?.trackKeyboard !== false;
		this.trackResize = config?.trackResize ?? false;
		this.trackErrors = config?.trackErrors !== false;
	}

	/** Change the rolling window duration at runtime. */
	setDuration(ms: number): void {
		this.durationMs = Math.max(5000, ms);
		this.gc();
	}

	getDuration(): number {
		return this.durationMs;
	}

	/** Manually push an action (used by BehaviorSensor). */
	record(action: UserAction): void {
		this.buffer.push(action);
		this.enforceMaxEntries();
	}

	/** Get all actions within the current rolling window, newest last. */
	getActions(): UserAction[] {
		this.gc();
		return [...this.buffer];
	}

	/** Get the N most recent actions. */
	getRecent(n: number): UserAction[] {
		this.gc();
		return this.buffer.slice(-n);
	}

	/** Current buffer size. */
	get size(): number {
		return this.buffer.length;
	}

	/** Wipe the buffer. */
	clear(): void {
		this.buffer = [];
	}

	/** Start auto-recording DOM events. */
	start(): void {
		if (this.started) {
			return;
		}
		this.started = true;

		this.listenClicks();
		this.listenScroll();

		if (this.trackNavigation) {
			this.listenNavigation();
		}
		if (this.trackFocus) {
			this.listenFocus();
		}
		if (this.trackKeyboard) {
			this.listenKeyboard();
		}
		if (this.trackResize) {
			this.listenResize();
		}
		if (this.trackErrors) {
			this.listenErrors();
		}

		this.gcTimer = setInterval(() => this.gc(), 5000);
	}

	/** Stop recording and clean up listeners. */
	stop(): void {
		this.started = false;
		for (const fn of this.cleanup) {
			fn();
		}
		this.cleanup = [];
		if (this.gcTimer) {
			clearInterval(this.gcTimer);
			this.gcTimer = null;
		}
	}

	/** Notify the recorder that a page navigation happened (for SPA routers). */
	recordNavigation(route: string): void {
		this.record({
			type: "navigate",
			route,
			timestamp: Date.now(),
		});
	}

	// ── Private: garbage collection ──────────────────────────

	private gc(): void {
		const cutoff = Date.now() - this.durationMs;
		let i = 0;
		while (i < this.buffer.length && this.buffer[i].timestamp < cutoff) {
			i++;
		}
		if (i > 0) {
			this.buffer.splice(0, i);
		}
	}

	private enforceMaxEntries(): void {
		if (this.buffer.length > this.maxEntries) {
			this.buffer.splice(0, this.buffer.length - this.maxEntries);
		}
	}

	private shouldThrottle(key: string): boolean {
		const now = Date.now();
		const last = this.lastThrottled.get(key) ?? 0;
		if (now - last < this.throttleMs) {
			return true;
		}
		this.lastThrottled.set(key, now);
		return false;
	}

	// ── Private: DOM listeners ───────────────────────────────

	private listenClicks(): void {
		const handler = (e: MouseEvent) => {
			const el = e.target instanceof Element ? e.target : null;
			if (!el || isIgnored(el)) {
				return;
			}
			const tag = el.tagName.toLowerCase();
			const text = (el.textContent ?? "").slice(0, 50).trim();
			const ariaLabel = el.getAttribute("aria-label");
			const href = el.getAttribute("href");
			const { module, section } = resolveModuleContext(el);

			this.record({
				type: "click",
				module,
				target: ariaLabel
					? `[${tag}] "${ariaLabel}"`
					: `[${tag}] "${text}"`,
				timestamp: Date.now(),
				detail: {
					...(href ? { href } : {}),
					...(section ? { section } : {}),
					x: Math.round(e.clientX),
					y: Math.round(e.clientY),
				},
			});
		};
		document.addEventListener("click", handler, { passive: true });
		this.cleanup.push(() => document.removeEventListener("click", handler));
	}

	private listenScroll(): void {
		const handler = () => {
			if (this.shouldThrottle("scroll")) {
				return;
			}
			const viewportModule = this.resolveViewportModule();
			this.record({
				type: "scroll",
				module: viewportModule,
				timestamp: Date.now(),
				detail: {
					scrollY: Math.round(window.scrollY),
					scrollPercent: Math.round(
						(window.scrollY /
							Math.max(
								1,
								document.documentElement.scrollHeight -
									window.innerHeight,
							)) *
							100,
					),
				},
			});
		};
		window.addEventListener("scroll", handler, { passive: true });
		this.cleanup.push(() => window.removeEventListener("scroll", handler));
	}

	private resolveViewportModule(): string | undefined {
		const centerX = window.innerWidth / 2;
		const centerY = window.innerHeight / 2;
		const el = document.elementFromPoint(centerX, centerY);
		if (!el) {
			return undefined;
		}
		return resolveModuleContext(el).module;
	}

	private listenNavigation(): void {
		const onPopState = () => {
			this.recordNavigation(window.location.pathname);
		};

		const origPushState = history.pushState.bind(history);
		const origReplaceState = history.replaceState.bind(history);

		history.pushState = (...args) => {
			origPushState(...args);
			this.recordNavigation(window.location.pathname);
		};
		history.replaceState = (...args) => {
			origReplaceState(...args);
			this.recordNavigation(window.location.pathname);
		};

		window.addEventListener("popstate", onPopState);
		this.cleanup.push(() => {
			window.removeEventListener("popstate", onPopState);
			history.pushState = origPushState;
			history.replaceState = origReplaceState;
		});
	}

	private listenFocus(): void {
		const onFocusIn = (e: FocusEvent) => {
			const el = e.target instanceof Element ? e.target : null;
			if (!el || isIgnored(el)) {
				return;
			}
			const tag = el.tagName.toLowerCase();
			if (
				!["input", "textarea", "select"].includes(tag) &&
				el.getAttribute("contenteditable") !== "true"
			) {
				return;
			}
			const { module } = resolveModuleContext(el);
			this.record({
				type: "focus",
				module,
				target: `[${tag}] ${el.getAttribute("name") ?? el.getAttribute("placeholder") ?? ""}`.trim(),
				timestamp: Date.now(),
			});
		};

		const onFocusOut = (e: FocusEvent) => {
			const el = e.target instanceof Element ? e.target : null;
			if (!el || isIgnored(el)) {
				return;
			}
			const tag = el.tagName.toLowerCase();
			if (
				!["input", "textarea", "select"].includes(tag) &&
				el.getAttribute("contenteditable") !== "true"
			) {
				return;
			}
			const { module } = resolveModuleContext(el);
			this.record({
				type: "blur",
				module,
				target: `[${tag}]`,
				timestamp: Date.now(),
			});
		};

		document.addEventListener("focusin", onFocusIn, { passive: true });
		document.addEventListener("focusout", onFocusOut, { passive: true });
		this.cleanup.push(() => {
			document.removeEventListener("focusin", onFocusIn);
			document.removeEventListener("focusout", onFocusOut);
		});
	}

	private listenKeyboard(): void {
		let keyCount = 0;
		let lastModule: string | undefined;
		let flushTimer: ReturnType<typeof setTimeout> | null = null;

		const handler = (e: KeyboardEvent) => {
			const el = e.target instanceof Element ? e.target : null;
			if (el && isIgnored(el)) {
				return;
			}
			keyCount++;
			if (el) {
				lastModule = resolveModuleContext(el).module;
			}
			if (flushTimer) {
				return;
			}
			flushTimer = setTimeout(() => {
				if (keyCount > 0) {
					this.record({
						type: "keypress",
						module: lastModule,
						timestamp: Date.now(),
						detail: { keyCount },
					});
				}
				keyCount = 0;
				lastModule = undefined;
				flushTimer = null;
			}, 1000);
		};

		document.addEventListener("keydown", handler, { passive: true });
		this.cleanup.push(() => {
			document.removeEventListener("keydown", handler);
			if (flushTimer) {
				clearTimeout(flushTimer);
			}
		});
	}

	private listenResize(): void {
		const handler = () => {
			if (this.shouldThrottle("resize")) {
				return;
			}
			this.record({
				type: "resize",
				timestamp: Date.now(),
				detail: {
					width: window.innerWidth,
					height: window.innerHeight,
				},
			});
		};
		window.addEventListener("resize", handler, { passive: true });
		this.cleanup.push(() => window.removeEventListener("resize", handler));
	}

	private listenErrors(): void {
		const handler = (e: ErrorEvent) => {
			const viewportModule = this.resolveViewportModule();
			this.record({
				type: "error",
				module: viewportModule,
				timestamp: Date.now(),
				detail: {
					message: e.message?.slice(0, 100),
					filename: e.filename?.split("/").pop(),
					line: e.lineno,
				},
			});
		};
		window.addEventListener("error", handler);
		this.cleanup.push(() => window.removeEventListener("error", handler));
	}
}
