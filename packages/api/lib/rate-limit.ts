const windowStore = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) {
		return;
	}
	lastCleanup = now;
	for (const [key, entry] of windowStore) {
		if (entry.resetAt < now) {
			windowStore.delete(key);
		}
	}
}

interface RateLimitConfig {
	windowMs: number;
	maxRequests: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
}

export function checkRateLimit(
	key: string,
	config: RateLimitConfig,
): RateLimitResult {
	cleanup();

	const now = Date.now();
	const entry = windowStore.get(key);

	if (!entry || entry.resetAt < now) {
		windowStore.set(key, { count: 1, resetAt: now + config.windowMs });
		return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
	}

	entry.count++;
	if (entry.count > config.maxRequests) {
		return { allowed: false, remaining: 0, resetAt: entry.resetAt };
	}

	return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

export const RATE_LIMITS = {
	auth: { windowMs: 15 * 60_000, maxRequests: 20 },
	otp: { windowMs: 5 * 60_000, maxRequests: 5 },
	signup: { windowMs: 60 * 60_000, maxRequests: 5 },
	api: { windowMs: 60_000, maxRequests: 100 },
	agentChat: { windowMs: 60_000, maxRequests: 30 },
} as const;

export function getClientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		return forwarded.split(",")[0].trim();
	}
	const real = request.headers.get("x-real-ip");
	if (real) {
		return real;
	}
	return "unknown";
}
