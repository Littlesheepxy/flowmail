"use client";

import { createQueryClient } from "@shared/lib/query-client";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

let clientQueryClientSingleton: QueryClient;
function getQueryClient() {
	if (typeof window === "undefined") {
		return createQueryClient();
	}

	if (!clientQueryClientSingleton) {
		clientQueryClientSingleton = createQueryClient();
	}

	return clientQueryClientSingleton;
}

export function ApiClientProvider({ children }: PropsWithChildren) {
	const queryClient = getQueryClient();

	return (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	);
}
