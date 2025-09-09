import { orpcClient } from "@shared/lib/orpc-client";
import { cache } from "react";

export const getPurchases = cache(async (organizationId?: string) => {
	const { purchases } = await orpcClient.payments.listPurchases({
		organizationId,
	});

	return purchases;
});
