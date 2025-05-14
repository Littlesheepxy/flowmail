import type { OrganizationMetadata } from "@repo/auth";
import { authClient } from "@repo/auth/client";
import { apiClient } from "@shared/lib/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";

export const organizationListQueryKey = ["user", "organizations"] as const;
export const useOrganizationListQuery = () => {
	return useQuery({
		queryKey: organizationListQueryKey,
		queryFn: async () => {
			const { data, error } = await authClient.organization.list();

			if (error) {
				throw new Error(
					error.message || "Failed to fetch organizations",
				);
			}

			return data;
		},
	});
};

export const activeOrganizationQueryKey = (slug: string) =>
	["user", "activeOrganization", slug] as const;
export const useActiveOrganizationQuery = (
	slug: string,
	options?: {
		enabled?: boolean;
	},
) => {
	return useQuery({
		queryKey: activeOrganizationQueryKey(slug),
		queryFn: async () => {
			const { data, error } =
				await authClient.organization.getFullOrganization({
					query: {
						organizationSlug: slug,
					},
				});

			if (error) {
				throw new Error(
					error.message || "Failed to fetch active organization",
				);
			}

			return data;
		},
		enabled: options?.enabled,
	});
};

export const fullOrganizationQueryKey = (id: string) =>
	["fullOrganization", id] as const;
export const useFullOrganizationQuery = (id: string) => {
	return useQuery({
		queryKey: fullOrganizationQueryKey(id),
		queryFn: async () => {
			const { data, error } =
				await authClient.organization.getFullOrganization({
					query: {
						organizationId: id,
					},
				});

			if (error) {
				throw new Error(
					error.message || "Failed to fetch full organization",
				);
			}

			return data;
		},
	});
};

export const generateOrganizationSlug = async (name: string) => {
	const response = await apiClient.organizations["generate-slug"].$get({
		query: {
			name,
		},
	});

	if (!response.ok) {
		throw new Error("Failed to generate organization slug");
	}

	const { slug } = await response.json();

	return slug;
};

/*
 * Create organization
 */
export const createOrganizationMutationKey = ["create-organization"] as const;
export const useCreateOrganizationMutation = () => {
	return useMutation({
		mutationKey: createOrganizationMutationKey,
		mutationFn: async ({
			name,
			metadata,
		}: {
			name: string;
			metadata?: OrganizationMetadata;
		}) => {
			const { error, data } = await authClient.organization.create({
				name,
				slug: await generateOrganizationSlug(name),
				metadata,
			});

			if (error) {
				throw error;
			}

			return data;
		},
	});
};

/*
 * Update organization
 */
export const updateOrganizationMutationKey = ["update-organization"] as const;
export const useUpdateOrganizationMutation = () => {
	return useMutation({
		mutationKey: updateOrganizationMutationKey,
		mutationFn: async ({
			id,
			name,
			metadata,
			updateSlug,
		}: {
			id: string;
			name: string;
			metadata?: OrganizationMetadata;
			updateSlug?: boolean;
		}) => {
			const { error, data } = await authClient.organization.update({
				organizationId: id,
				data: {
					name,
					slug: updateSlug
						? await generateOrganizationSlug(name)
						: undefined,
					metadata,
				},
			});

			if (error) {
				throw error;
			}

			return data;
		},
	});
};
