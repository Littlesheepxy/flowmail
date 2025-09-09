"use client";

import { config } from "@repo/config";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { useOrganizationListQuery } from "@saas/organizations/lib/api";
import { Card } from "@ui/components/card";
import { ChevronRightIcon, PlusCircleIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function OrganizationsGrid() {
	const t = useTranslations();
	const { setActiveOrganization } = useActiveOrganization();
	const { data: allOrganizations } = useOrganizationListQuery();

	return (
		<div className="@container">
			<h2 className="mb-2 font-semibold text-lg">
				{t("organizations.organizationsGrid.title")}
			</h2>
			<div className="grid @2xl:grid-cols-3 @lg:grid-cols-2 grid-cols-1 gap-4">
				{allOrganizations?.map((organization) => (
					<Card
						key={organization.id}
						className="flex cursor-pointer items-center gap-4 overflow-hidden p-4"
						onClick={() => setActiveOrganization(organization.slug)}
					>
						<OrganizationLogo
							name={organization.name}
							logoUrl={organization.logo}
							className="size-12"
						/>
						<span className="flex items-center gap-1 text-base leading-tight">
							<span className="block font-medium">
								{organization.name}
							</span>
							<ChevronRightIcon className="size-4" />
						</span>
					</Card>
				))}

				{config.organizations.enableUsersToCreateOrganizations && (
					<Link
						href="/new-organization"
						className="flex h-full items-center justify-center gap-2 rounded-2xl bg-primary/5 p-4 text-primary transition-colors duration-150 hover:bg-primary/10"
					>
						<PlusCircleIcon />
						<span className="font-medium text-sm">
							{t(
								"organizations.organizationsGrid.createNewOrganization",
							)}
						</span>
					</Link>
				)}
			</div>
		</div>
	);
}
