import { logger } from "@repo/logs";
import { logger as honoLogger } from "hono/logger";

export const loggerMiddleware = honoLogger((message, ...rest) => {
	logger.log(message, ...rest);
});
