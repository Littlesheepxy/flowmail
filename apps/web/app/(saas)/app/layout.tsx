import { config } from "@repo/config";
import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { sessionQueryKey } from "@saas/auth/lib/api";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { ActiveOrganizationProvider } from "@saas/organizations/components/ActiveOrganizationProvider";
import { organizationListQueryKey } from "@saas/organizations/lib/api";
import { purchasesQueryKey } from "@saas/payments/lib/api";
import { getPurchases } from "@saas/payments/lib/server";
import { ConfirmationAlertProvider } from "@saas/shared/components/ConfirmationAlertProvider";
import { getServerQueryClient } from "@shared/lib/server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Layout({ children }: PropsWithChildren) {
	const session = await getSession();

	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery({
		queryKey: sessionQueryKey,
		queryFn: () => session,
	});

	if (config.organizations.enable) {
		await queryClient.prefetchQuery({
			queryKey: organizationListQueryKey,
			queryFn: getOrganizationList,
		});
	}

	if (config.users.enableBilling) {
		await queryClient.prefetchQuery({
			queryKey: purchasesQueryKey(),
			queryFn: () => getPurchases(),
		});
	}

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<SessionProvider>
				<ActiveOrganizationProvider>
					<ConfirmationAlertProvider>
						{children}
					</ConfirmationAlertProvider>
				</ActiveOrganizationProvider>
			</SessionProvider>
		</HydrationBoundary>
	);
}
