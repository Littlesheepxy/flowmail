import "server-only";
import { createQueryClient } from "@shared/lib/query-client";

import type { AppRouter } from "@repo/api";
import { getBaseUrl } from "@repo/utils";
import { hc } from "hono/client";
import { headers } from "next/headers";
import { cache } from "react";

export const getServerQueryClient = cache(createQueryClient);

export const getServerApiClient = async () => {
	const headerObject = Object.fromEntries((await headers()).entries());

	return hc<AppRouter>(getBaseUrl(), {
		init: {
			credentials: "include",
			headers: headerObject,
		},
	}).api;
};
