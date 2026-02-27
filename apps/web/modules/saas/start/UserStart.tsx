"use client";

import { config } from "@repo/auth/config";
import { Card } from "@repo/ui/components/card";
import { OrganizationsGrid } from "@saas/organizations/components/OrganizationsGrid";

export default function UserStart() {
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
