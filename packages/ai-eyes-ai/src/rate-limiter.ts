export class RateLimiter {
	private lastCallAt = 0;
	private cooldownMs: number;

	constructor(cooldownMs = 15000) {
		this.cooldownMs = cooldownMs;
	}

	get canCall(): boolean {
		return Date.now() - this.lastCallAt > this.cooldownMs;
	}

	get remainingMs(): number {
		return Math.max(0, this.cooldownMs - (Date.now() - this.lastCallAt));
	}

	record(): void {
		this.lastCallAt = Date.now();
	}

	reset(): void {
		this.lastCallAt = 0;
	}
}
