import type { ConfusionEvent, HelpSuggestion } from "@ai-eyes/core";
import type { AiAdapter, AnalyzeResponse } from "./adapters/types";
import { RateLimiter } from "./rate-limiter";

interface AnalyzerConfig {
	adapter: AiAdapter;
	cooldownMs?: number;
	maxRetries?: number;
}

export class AnalyzerEngine {
	private adapter: AiAdapter;
	private rateLimiter: RateLimiter;
	private maxRetries: number;

	constructor(config: AnalyzerConfig) {
		this.adapter = config.adapter;
		this.rateLimiter = new RateLimiter(config.cooldownMs ?? 15000);
		this.maxRetries = config.maxRetries ?? 1;
	}

	async analyze(
		event: ConfusionEvent,
		appContext?: Record<string, unknown>,
	): Promise<HelpSuggestion | null> {
		if (!this.rateLimiter.canCall) {
			return null;
		}

		this.rateLimiter.record();

		let lastError: Error | undefined;
		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				const result: AnalyzeResponse = await this.adapter.analyze({
					confusionEvent: event,
					appContext,
				});
				return result;
			} catch (err) {
				lastError = err instanceof Error ? err : new Error(String(err));
			}
		}

		console.warn("[ai-eyes] Analysis failed:", lastError?.message);
		return null;
	}

	get isOnCooldown(): boolean {
		return !this.rateLimiter.canCall;
	}

	reset(): void {
		this.rateLimiter.reset();
	}
}
