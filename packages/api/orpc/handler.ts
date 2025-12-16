import { onError } from "@orpc/client";
import { experimental_SmartCoercionPlugin as SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { logger } from "@repo/logs";
import { router } from "./router";

export const rpcHandler = new RPCHandler(router, {
	clientInterceptors: [
		onError((error) => {
			logger.error(error);
		}),
	],
});

export const openApiHandler = new OpenAPIHandler(router, {
	plugins: [
		new SmartCoercionPlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	clientInterceptors: [
		onError((error) => {
			logger.error(error);
		}),
	],
});
