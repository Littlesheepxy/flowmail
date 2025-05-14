import { apiClient } from "@shared/lib/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { InferRequestType } from "hono";

export const createCustomerPortalLinkMutationKey = [
	"create-customer-portal-link",
] as const;
export const useCreateCustomerPortalLinkMutation = () => {
	return useMutation({
		mutationKey: createCustomerPortalLinkMutationKey,
		mutationFn: async (
			query: InferRequestType<
				(typeof apiClient.payments)["create-customer-portal-link"]["$post"]
			>["query"],
		) => {
			const response = await apiClient.payments[
				"create-customer-portal-link"
			].$post({
				query,
			});

			if (!response.ok) {
				throw new Error("Failed to create customer portal link");
			}

			return response.json();
		},
	});
};

export const createCheckoutLinkMutationKey = ["create-checkout-link"] as const;
export const useCreateCheckoutLinkMutation = () => {
	return useMutation({
		mutationKey: createCheckoutLinkMutationKey,
		mutationFn: async (
			query: InferRequestType<
				(typeof apiClient.payments)["create-checkout-link"]["$post"]
			>["query"],
		) => {
			const response = await apiClient.payments[
				"create-checkout-link"
			].$post({
				query,
			});

			if (!response.ok) {
				throw new Error("Failed to create checkout link");
			}

			return response.json();
		},
	});
};

export const purchasesQueryKey = (organizationId?: string) =>
	organizationId
		? ["organization", "purchases", organizationId]
		: (["user", "purchases"] as const);
export const usePurchasesQuery = (
	organizationId?: string,
	options?: { enabled?: boolean },
) => {
	return useQuery({
		queryKey: purchasesQueryKey(organizationId),
		queryFn: async () => {
			const response = await apiClient.payments.purchases.$get({
				query: {
					organizationId,
				},
			});

			if (!response.ok) {
				throw new Error("Failed to fetch purchases");
			}

			return response.json();
		},
		...options,
	});
};
