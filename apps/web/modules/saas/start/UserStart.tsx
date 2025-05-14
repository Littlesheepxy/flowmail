"use client";
import { config } from "@repo/config";
import { useSession } from "@saas/auth/hooks/use-session";
import { OrganizationsGrid } from "@saas/organizations/components/OrganizationsGrid";
import { Card } from "@ui/components/card";
import { useTranslations } from "next-intl";

export default function UserStart() {
	const t = useTranslations();
	const { user } = useSession();

	return (
		<div>
			{config.organizations.enable && <OrganizationsGrid />}

			<Card className="mt-6">
				<div className="flex h-64 items-center justify-center p-8 text-foreground/60">
					Place your content here...
				</div>
			</Card>
		</div>
	);
}
