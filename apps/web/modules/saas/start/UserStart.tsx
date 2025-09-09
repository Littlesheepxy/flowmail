"use client";

import { config } from "@repo/config";
import { OrganizationsGrid } from "@saas/organizations/components/OrganizationsGrid";
import { Card } from "@ui/components/card";

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
