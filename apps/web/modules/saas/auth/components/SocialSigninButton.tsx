"use client";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { parseAsString, useQueryState } from "nuqs";
import { config } from "@/config";
import { oAuthProviders } from "../constants/oauth-providers";

export function SocialSigninButton({
	provider,
	className,
}: {
	provider: keyof typeof oAuthProviders;
	className?: string;
}) {
	const [invitationId] = useQueryState("invitationId", parseAsString);
	const providerData = oAuthProviders[provider];

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: config.saas.redirectAfterSignIn;

	const onSignin = () => {
		const callbackURL = new URL(redirectPath, window.location.origin);
		authClient.signIn.social({
			provider,
			callbackURL: callbackURL.toString(),
		});
	};

	return (
		<Button
			onClick={() => onSignin()}
			variant="outline"
			type="button"
			className={className}
		>
			{providerData.icon && (
				<span className="mr-2 inline-flex shrink-0 items-center justify-center">
					<providerData.icon className="size-4" />
				</span>
			)}
			{providerData.name}
		</Button>
	);
}
