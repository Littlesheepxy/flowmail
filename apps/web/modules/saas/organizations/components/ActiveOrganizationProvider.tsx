"use client";

import { authClient } from "@repo/auth/client";
import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { config } from "@repo/config";
import { useSession } from "@saas/auth/hooks/use-session";
import { sessionQueryKey } from "@saas/auth/lib/api";
import {
	activeOrganizationQueryKey,
	useActiveOrganizationQuery,
} from "@saas/organizations/lib/api";
import { purchasesQueryKey } from "@saas/payments/lib/api";
import { useRouter } from "@shared/hooks/router";
import { apiClient } from "@shared/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import nProgress from "nprogress";
import { type ReactNode, useEffect, useState } from "react";
import { ActiveOrganizationContext } from "../lib/active-organization-context";

export function ActiveOrganizationProvider({
	children,
}: {
	children: ReactNode;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { session, user } = useSession();
	const params = useParams();

	const activeOrganizationSlug = params.organizationSlug as string;

	const { data: activeOrganization } = useActiveOrganizationQuery(
		activeOrganizationSlug,
		{
			enabled: !!activeOrganizationSlug,
		},
	);

	const refetchActiveOrganization = async () => {
		await queryClient.refetchQueries({
			queryKey: activeOrganizationQueryKey(activeOrganizationSlug),
		});
	};

	const setActiveOrganization = async (organizationSlug: string | null) => {
		nProgress.start();
		const { data: newActiveOrganization } =
			await authClient.organization.setActive(
				organizationSlug
					? {
							organizationSlug,
						}
					: {
							organizationId: null,
						},
			);

		if (!newActiveOrganization) {
			nProgress.done();
			return;
		}

		await queryClient.setQueryData(
			activeOrganizationQueryKey(newActiveOrganization.slug),
			newActiveOrganization,
		);

		if (config.organizations.enableBilling) {
			await queryClient.prefetchQuery({
				queryKey: purchasesQueryKey(newActiveOrganization.id),
				queryFn: async () => {
					const response = await apiClient.payments.purchases.$get({
						query: {
							organizationId: newActiveOrganization.id,
						},
					});

					if (!response.ok) {
						throw new Error("Failed to fetch purchases");
					}

					return response.json();
				},
			});
		}

		await queryClient.setQueryData(sessionQueryKey, (data: any) => {
			return {
				...data,
				session: {
					...data?.session,
					activeOrganizationId: newActiveOrganization.id,
				},
			};
		});

		router.push(`/app/${newActiveOrganization.slug}`);
	};

	const [loaded, setLoaded] = useState(activeOrganization !== undefined);

	useEffect(() => {
		if (!loaded && activeOrganization !== undefined) {
			setLoaded(true);
		}
	}, [activeOrganization]);

	const activeOrganizationUserRole = activeOrganization?.members.find(
		(member) => member.userId === session?.userId,
	)?.role;

	return (
		<ActiveOrganizationContext.Provider
			value={{
				loaded,
				activeOrganization: activeOrganization ?? null,
				activeOrganizationUserRole: activeOrganizationUserRole ?? null,
				isOrganizationAdmin:
					!!activeOrganization &&
					!!user &&
					isOrganizationAdmin(activeOrganization, user),
				setActiveOrganization,
				refetchActiveOrganization,
			}}
		>
			{children}
		</ActiveOrganizationContext.Provider>
	);
}
