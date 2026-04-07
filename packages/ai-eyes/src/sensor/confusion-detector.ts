import {
	DEFAULT_SENSOR_CONFIG,
	DEFAULT_SIGNAL_WEIGHTS,
	MAX_SIGNALS_IN_WINDOW,
	REPEAT_DECAY,
} from "../constants";
import type {
	ConfusionEvent,
	ConfusionSignal,
	PageContext,
	SensorConfig,
	SignalType,
	UserAction,
} from "../types";

type ConfusionHandler = (event: ConfusionEvent) => void;

export class ConfusionDetector {
	private signals: ConfusionSignal[] = [];
	private weights: Record<SignalType, number>;
	private threshold: number;
	private windowMs: number;
	private cooldownMs: number;
	private lastTriggerAt = 0;
	private handlers: ConfusionHandler[] = [];

	constructor(config?: SensorConfig) {
		this.weights = {
			...DEFAULT_SIGNAL_WEIGHTS,
			...config?.signalWeights,
		};
		this.threshold =
			config?.confusionThreshold ??
			DEFAULT_SENSOR_CONFIG.confusionThreshold;
		this.windowMs = config?.windowMs ?? DEFAULT_SENSOR_CONFIG.windowMs;
		this.cooldownMs =
			config?.cooldownMs ?? DEFAULT_SENSOR_CONFIG.cooldownMs;
	}

	onConfusion(handler: ConfusionHandler): () => void {
		this.handlers.push(handler);
		return () => {
			this.handlers = this.handlers.filter((h) => h !== handler);
		};
	}

	addSignal(
		signal: ConfusionSignal,
		context: PageContext,
		recentActions: UserAction[],
	): void {
		const now = Date.now();
		this.signals.push(signal);

		const cutoff = now - this.windowMs;
		this.signals = this.signals
			.filter((s) => s.timestamp > cutoff)
			.slice(-MAX_SIGNALS_IN_WINDOW);

		const score = this.calculateScore();

		if (
			score >= this.threshold &&
			now - this.lastTriggerAt > this.cooldownMs
		) {
			this.lastTriggerAt = now;
			const event: ConfusionEvent = {
				score,
				signals: [...this.signals],
				context,
				recentActions,
				timestamp: now,
			};
			for (const h of this.handlers) {
				h(event);
			}
		}
	}

	getScore(): number {
		const now = Date.now();
		const cutoff = now - this.windowMs;
		this.signals = this.signals.filter((s) => s.timestamp > cutoff);
		return this.calculateScore();
	}

	get isOnCooldown(): boolean {
		return Date.now() - this.lastTriggerAt < this.cooldownMs;
	}

	reset(): void {
		this.signals = [];
		this.lastTriggerAt = 0;
	}

	private calculateScore(): number {
		const typeCounts = new Map<SignalType, number>();
		let total = 0;

		for (const signal of this.signals) {
			const prevCount = typeCounts.get(signal.type) ?? 0;
			const decay = REPEAT_DECAY ** prevCount;
			total += this.weights[signal.type] * decay;
			typeCounts.set(signal.type, prevCount + 1);
		}

		return Math.min(100, Math.round(total));
	}
}
