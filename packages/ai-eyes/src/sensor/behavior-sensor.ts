import { DEFAULT_SENSOR_CONFIG } from "../constants";
import type {
	ConfusionSignal,
	RecorderConfig,
	SensorConfig,
	UserAction,
} from "../types";
import { ActionRecorder } from "./action-recorder";

type SignalHandler = (signal: ConfusionSignal) => void;

function getElementInfo(el: Element) {
	const rect = el.getBoundingClientRect();
	const dataAttributes: Record<string, string> = {};
	for (const attr of el.attributes) {
		if (attr.name.startsWith("data-")) {
			dataAttributes[attr.name] = attr.value;
		}
	}
	return {
		tagName: el.tagName.toLowerCase(),
		textContent: (el.textContent ?? "").slice(0, 80).trim(),
		ariaLabel: el.getAttribute("aria-label") ?? undefined,
		dataAttributes,
		rect: {
			x: Math.round(rect.x),
			y: Math.round(rect.y),
			width: Math.round(rect.width),
			height: Math.round(rect.height),
		},
	};
}

function isInteractive(el: Element): boolean {
	const tag = el.tagName.toLowerCase();
	if (
		["a", "button", "input", "select", "textarea", "summary"].includes(tag)
	) {
		return true;
	}
	const role = el.getAttribute("role");
	if (
		role &&
		["button", "link", "tab", "menuitem", "option"].includes(role)
	) {
		return true;
	}
	if (el.getAttribute("tabindex") !== null) {
		return true;
	}
	return false;
}

function isInputElement(el: Element): boolean {
	const tag = el.tagName.toLowerCase();
	return (
		tag === "input" ||
		tag === "textarea" ||
		el.getAttribute("contenteditable") === "true"
	);
}

export class BehaviorSensor {
	private config: Required<
		Pick<
			SensorConfig,
			| "idleThreshold"
			| "hoverHesitationCount"
			| "rageClickWindow"
			| "rageClickCount"
			| "scrollBounceWindow"
			| "scrollBounceCount"
			| "emptyStateDelay"
			| "longPageStayDelay"
		>
	>;
	private handlers: SignalHandler[] = [];
	readonly recorder: ActionRecorder;
	private cleanup: (() => void)[] = [];
	private started = false;

	private idleTimer: ReturnType<typeof setTimeout> | null = null;
	private lastMouseElement: Element | null = null;
	private hoverMap = new Map<string, { count: number; lastTime: number }>();
	private clickLog: Array<{ x: number; y: number; time: number }> = [];
	private scrollLog: Array<{ y: number; time: number; direction: number }> =
		[];
	private emptyStateTimer: ReturnType<typeof setTimeout> | null = null;
	private longStayTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(config?: SensorConfig, recorderConfig?: RecorderConfig) {
		this.config = {
			idleThreshold:
				config?.idleThreshold ?? DEFAULT_SENSOR_CONFIG.idleThreshold,
			hoverHesitationCount:
				config?.hoverHesitationCount ??
				DEFAULT_SENSOR_CONFIG.hoverHesitationCount,
			rageClickWindow:
				config?.rageClickWindow ??
				DEFAULT_SENSOR_CONFIG.rageClickWindow,
			rageClickCount:
				config?.rageClickCount ?? DEFAULT_SENSOR_CONFIG.rageClickCount,
			scrollBounceWindow:
				config?.scrollBounceWindow ??
				DEFAULT_SENSOR_CONFIG.scrollBounceWindow,
			scrollBounceCount:
				config?.scrollBounceCount ??
				DEFAULT_SENSOR_CONFIG.scrollBounceCount,
			emptyStateDelay:
				config?.emptyStateDelay ??
				DEFAULT_SENSOR_CONFIG.emptyStateDelay,
			longPageStayDelay:
				config?.longPageStayDelay ??
				DEFAULT_SENSOR_CONFIG.longPageStayDelay,
		};
		this.recorder = new ActionRecorder(recorderConfig);
	}

	onSignal(handler: SignalHandler): () => void {
		this.handlers.push(handler);
		return () => {
			this.handlers = this.handlers.filter((h) => h !== handler);
		};
	}

	getRecentActions(): UserAction[] {
		return this.recorder.getActions();
	}

	start(): void {
		if (this.started) {
			return;
		}
		this.started = true;
		this.pageEnteredAt = Date.now();

		this.recorder.start();

		const onMouseMove = (e: MouseEvent) => this.handleMouseMove(e);
		const onClick = (e: MouseEvent) => this.handleClick(e);
		const onScroll = () => this.handleScroll();

		document.addEventListener("mousemove", onMouseMove, { passive: true });
		document.addEventListener("click", onClick, { passive: true });
		window.addEventListener("scroll", onScroll, { passive: true });

		this.cleanup.push(() => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("click", onClick);
			window.removeEventListener("scroll", onScroll);
		});

		this.startLongStayTimer();
		this.checkForEmptyStates();
	}

	stop(): void {
		this.started = false;
		this.recorder.stop();
		for (const fn of this.cleanup) {
			fn();
		}
		this.cleanup = [];
		this.clearTimers();
	}

	resetForNavigation(): void {
		this.hoverMap.clear();
		this.clickLog = [];
		this.scrollLog = [];
		this.pageEnteredAt = Date.now();
		this.recorder.recordNavigation(window.location.pathname);
		this.clearTimers();
		if (this.started) {
			this.startLongStayTimer();
			setTimeout(() => this.checkForEmptyStates(), 1000);
		}
	}

	private emit(signal: ConfusionSignal): void {
		for (const h of this.handlers) {
			h(signal);
		}
	}

	private clearTimers(): void {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
		if (this.emptyStateTimer) {
			clearTimeout(this.emptyStateTimer);
			this.emptyStateTimer = null;
		}
		if (this.longStayTimer) {
			clearTimeout(this.longStayTimer);
			this.longStayTimer = null;
		}
	}

	private handleMouseMove(e: MouseEvent): void {
		const el = document.elementFromPoint(e.clientX, e.clientY);
		if (!el || isInputElement(el)) {
			return;
		}

		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
		}

		if (isInteractive(el)) {
			const key = `${el.tagName}-${el.textContent?.slice(0, 30)}`;

			if (el !== this.lastMouseElement) {
				const entry = this.hoverMap.get(key);
				const now = Date.now();
				if (entry && now - entry.lastTime < 5000) {
					entry.count++;
					entry.lastTime = now;
					if (entry.count >= this.config.hoverHesitationCount) {
						this.emit({
							type: "hover_hesitation",
							element: getElementInfo(el),
							count: entry.count,
							timestamp: now,
						});
						this.hoverMap.delete(key);
					}
				} else {
					this.hoverMap.set(key, { count: 1, lastTime: now });
				}
			}

			this.idleTimer = setTimeout(() => {
				this.emit({
					type: "idle",
					element: getElementInfo(el),
					duration: this.config.idleThreshold,
					timestamp: Date.now(),
				});
			}, this.config.idleThreshold);
		}

		this.lastMouseElement = el;
	}

	private handleClick(e: MouseEvent): void {
		const now = Date.now();
		const el = e.target instanceof Element ? e.target : null;

		this.clickLog.push({ x: e.clientX, y: e.clientY, time: now });
		const cutoff = now - this.config.rageClickWindow;
		this.clickLog = this.clickLog.filter((c) => c.time > cutoff);

		const nearbyClicks = this.clickLog.filter(
			(c) =>
				Math.abs(c.x - e.clientX) < 50 &&
				Math.abs(c.y - e.clientY) < 50,
		);
		if (nearbyClicks.length >= this.config.rageClickCount && el) {
			this.emit({
				type: "rage_click",
				element: getElementInfo(el),
				count: nearbyClicks.length,
				timestamp: now,
			});
			this.clickLog = [];
		}

		if (this.longStayTimer) {
			clearTimeout(this.longStayTimer);
			this.startLongStayTimer();
		}
	}

	private handleScroll(): void {
		const now = Date.now();
		const y = window.scrollY;
		const prev = this.scrollLog[this.scrollLog.length - 1];
		const direction = prev ? Math.sign(y - prev.y) : 0;

		this.scrollLog.push({ y, time: now, direction });

		const cutoff = now - this.config.scrollBounceWindow;
		this.scrollLog = this.scrollLog.filter((s) => s.time > cutoff);

		let bounces = 0;
		for (let i = 1; i < this.scrollLog.length; i++) {
			if (
				this.scrollLog[i].direction !== 0 &&
				this.scrollLog[i].direction !== this.scrollLog[i - 1].direction
			) {
				bounces++;
			}
		}

		if (bounces >= this.config.scrollBounceCount) {
			this.emit({
				type: "scroll_bounce",
				count: bounces,
				timestamp: now,
			});
			this.scrollLog = [];
		}
	}

	private startLongStayTimer(): void {
		this.longStayTimer = setTimeout(() => {
			this.emit({
				type: "long_page_stay",
				duration: this.config.longPageStayDelay,
				timestamp: Date.now(),
			});
		}, this.config.longPageStayDelay);
	}

	private checkForEmptyStates(): void {
		this.emptyStateTimer = setTimeout(() => {
			const emptyIndicators = document.querySelectorAll(
				'[data-empty-state], .empty-state, [aria-label*="empty"], [aria-label*="no data"]',
			);
			if (emptyIndicators.length > 0) {
				const first = emptyIndicators[0];
				this.emit({
					type: "empty_state_stare",
					element: getElementInfo(first),
					duration: this.config.emptyStateDelay,
					timestamp: Date.now(),
				});
			}
		}, this.config.emptyStateDelay);
	}
}
