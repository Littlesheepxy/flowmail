import { apiClient } from "@shared/lib/api-client";
import { createQueryKeyWithParams } from "@shared/lib/query-client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

/*
 * Admin users
 */
type FetchAdminUsersParams = {
	itemsPerPage: number;
	currentPage: number;
	searchTerm: string;
};

export const adminUsersQueryKey = ["admin", "users"];
export const fetchAdminUsers = async ({
	itemsPerPage,
	currentPage,
	searchTerm,
}: FetchAdminUsersParams) => {
	const response = await apiClient.admin.users.$get({
		query: {
			limit: itemsPerPage.toString(),
			offset: ((currentPage - 1) * itemsPerPage).toString(),
			query: searchTerm,
		},
	});

	if (!response.ok) {
		throw new Error("Could not fetch users");
	}

	return response.json();
};
export const useAdminUsersQuery = (params: FetchAdminUsersParams) => {
	return useQuery({
		queryKey: createQueryKeyWithParams(adminUsersQueryKey, params),
		queryFn: () => fetchAdminUsers(params),
		retry: false,
		refetchOnWindowFocus: false,
		placeholderData: keepPreviousData,
	});
};

/*
 * Admin organizations
 */
type FetchAdminOrganizationsParams = {
	itemsPerPage: number;
	currentPage: number;
	searchTerm: string;
};
export const adminOrganizationsQueryKey = ["admin", "organizations"];
export const fetchAdminOrganizations = async ({
	itemsPerPage,
	currentPage,
	searchTerm,
}: FetchAdminOrganizationsParams) => {
	const response = await apiClient.admin.organizations.$get({
		query: {
			limit: itemsPerPage.toString(),
			offset: ((currentPage - 1) * itemsPerPage).toString(),
			query: searchTerm,
		},
	});

	if (!response.ok) {
		throw new Error("Could not fetch organizations");
	}

	return response.json();
};
export const useAdminOrganizationsQuery = (
	params: FetchAdminOrganizationsParams,
) => {
	return useQuery({
		queryKey: createQueryKeyWithParams(adminOrganizationsQueryKey, params),
		queryFn: () => fetchAdminOrganizations(params),
		retry: false,
		refetchOnWindowFocus: false,
		placeholderData: keepPreviousData,
	});
};
