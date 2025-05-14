import { getServerApiClient } from "@shared/lib/server";
import { cache } from "react";

export const getPurchases = cache(async (organizationId?: string) => {
	const apiClient = await getServerApiClient();
	const response = await apiClient.payments.purchases.$get({
		query: {
			organizationId,
		},
	});

	if (!response.ok) {
		throw new Error("Failed to fetch purchases");
	}

	return response.json();
});
