import { auth } from "@repo/auth";
import { logger } from "@repo/logs";
import { webhookHandler as paymentsWebhookHandler } from "@repo/payments";
import { getBaseUrl } from "@repo/utils";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { openApiHandler, rpcHandler } from "./orpc/handler";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "./lib/rate-limit";

export { verifyApiToken } from "./modules/api-tokens/lib/token-utils";
export { triggerNotification } from "./modules/notifications/lib/trigger";
export { checkRateLimit, getClientIp, RATE_LIMITS } from "./lib/rate-limit";
export { writeAuditLog, extractRequestMeta } from "./lib/audit-log";
export {
	getOrCreateInboundAddress,
	resolveOrganizationByInboundAddress,
} from "./modules/email-connections/lib/inbound-address";
export {
	ViewSpecSchema,
	ViewBlockSchema,
	VIEW_COMPONENT_DOCS,
	type ViewSpec,
	type ViewBlock,
	type SummaryBlock,
	type KpiCardsBlock,
	type TodoListBlock,
	type TimelineBlock,
	type TableBlock,
	type QuickActionsBlock,
} from "./modules/entity-views/types";

export const app = new Hono()
	.basePath("/api")
	// Logger middleware
	.use(honoLogger((message, ...rest) => logger.log(message, ...rest)))
	// Cors middleware
	.use(
		cors({
			origin: getBaseUrl(),
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	)
	// Rate limit on auth endpoints
	.use("/auth/*", async (c, next) => {
		const ip = getClientIp(c.req.raw);
		const path = c.req.path;

		const isOtp = path.includes("otp") || path.includes("verify");
		const isSignup = path.includes("sign-up");
		const limit = isOtp ? RATE_LIMITS.otp : isSignup ? RATE_LIMITS.signup : RATE_LIMITS.auth;
		const key = `auth:${ip}:${isOtp ? "otp" : isSignup ? "signup" : "login"}`;

		const result = checkRateLimit(key, limit);
		c.header("X-RateLimit-Remaining", String(result.remaining));
		c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

		if (!result.allowed) {
			return c.json({ error: "Too many requests. Please try again later." }, 429);
		}

		await next();
	})
	// Auth handler
	.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw))
	// Payments webhook handler
	.post("/webhooks/payments", (c) => paymentsWebhookHandler(c.req.raw))
	// Health check
	.get("/health", (c) => c.text("OK"))
	// oRPC handlers (for RPC and OpenAPI)
	.use("*", async (c, next) => {
		const context = {
			headers: c.req.raw.headers,
		};

		const isRpc = c.req.path.includes("/rpc/");

		const handler = isRpc ? rpcHandler : openApiHandler;

		const prefix = isRpc ? "/api/rpc" : "/api";

		const { matched, response } = await handler.handle(c.req.raw, {
			prefix,
			context,
		});

		if (matched) {
			return c.newResponse(response.body, response);
		}

		await next();
	});
