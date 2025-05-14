import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import type { PropsWithChildren } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthLayout({ children }: PropsWithChildren) {
	return (
		<SessionProvider>
			<AuthWrapper>{children}</AuthWrapper>
		</SessionProvider>
	);
}
