import type { AppRouter } from "@repo/api";
import { getBaseUrl } from "@repo/utils";
import { hc } from "hono/client";

export const apiClient = hc<AppRouter>(getBaseUrl(), {
	init: {
		credentials: "include",
	},
}).api;
