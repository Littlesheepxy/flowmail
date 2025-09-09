import { auth } from "@repo/auth";
import { OrganizationForm } from "@saas/admin/component/organizations/OrganizationForm";
import { getAdminPath } from "@saas/admin/lib/links";
import { fullOrganizationQueryKey } from "@saas/organizations/lib/api";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function OrganizationFormPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ backTo?: string }>;
}) {
	const { id } = await params;
	const { backTo } = await searchParams;

	const t = await getTranslations();
	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery({
		queryKey: fullOrganizationQueryKey(id),
		queryFn: async () =>
			await auth.api.getFullOrganization({
				query: {
					organizationId: id,
				},
				headers: await headers(),
			}),
	});

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<div>
				<div className="mb-2 flex justify-start">
					<Button variant="link" size="sm" asChild className="px-0">
						<Link href={backTo ?? getAdminPath("/organizations")}>
							<ArrowLeftIcon className="mr-1.5 size-4" />
							{t("admin.organizations.backToList")}
						</Link>
					</Button>
				</div>
				<OrganizationForm organizationId={id} />
			</div>
		</HydrationBoundary>
	);
}
