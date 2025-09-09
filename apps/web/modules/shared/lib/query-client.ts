import {
	defaultShouldDehydrateQuery,
	QueryClient,
} from "@tanstack/react-query";

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000,
				retry: false,
			},
			dehydrate: {
				shouldDehydrateQuery: (query) =>
					defaultShouldDehydrateQuery(query) ||
					query.state.status === "pending",
			},
		},
	});
}

export function createQueryKeyWithParams(
	key: string | string[],
	params: Record<string, string | number>,
) {
	return [
		...(Array.isArray(key) ? key : [key]),
		Object.entries(params)
			.reduce((acc, [key, value]) => {
				acc.push(`${key}:${value}`);
				return acc;
			}, [] as string[])
			.join("_"),
	] as const;
}
