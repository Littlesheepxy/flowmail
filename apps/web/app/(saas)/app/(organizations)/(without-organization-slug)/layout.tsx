import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import type { PropsWithChildren } from "react";

export default function WithoutOrganizationSlugLayout({
	children,
}: PropsWithChildren) {
	return <AuthWrapper>{children}</AuthWrapper>;
}
