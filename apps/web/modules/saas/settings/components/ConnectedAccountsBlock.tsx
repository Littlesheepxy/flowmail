"use client";
import { authClient } from "@repo/auth/client";
import {
	type OAuthProvider,
	oAuthProviders,
} from "@saas/auth/constants/oauth-providers";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Skeleton } from "@ui/components/skeleton";
import { CheckCircle2Icon, LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function ConnectedAccountsBlock() {
	const t = useTranslations();

	const { data, isPending } = useQuery({
		queryKey: ["userAccounts"],
		queryFn: async () => {
			const { data, error } = await authClient.listAccounts();

			if (error) {
				throw error;
			}

			return data;
		},
	});

	const isProviderLinked = (provider: OAuthProvider) =>
		data?.some((account) => account.provider === provider);

	const linkProvider = (provider: OAuthProvider) => {
		const callbackURL = window.location.href;
		if (!isProviderLinked(provider)) {
			authClient.linkSocial({
				provider,
				callbackURL,
			});
		}
	};

	return (
		<SettingsItem
			title={t("settings.account.security.connectedAccounts.title")}
		>
			<div className="grid grid-cols-1 divide-y">
				{Object.entries(oAuthProviders).map(
					([provider, providerData]) => {
						const isLinked = isProviderLinked(
							provider as OAuthProvider,
						);

						return (
							<div
								key={provider}
								className="flex h-14 items-center justify-between gap-2 py-2"
							>
								<div className="flex items-center gap-2">
									<providerData.icon className="size-4 text-primary/50" />
									<span className="text-sm">
										{providerData.name}
									</span>
								</div>
								{isPending ? (
									<Skeleton className="h-10 w-28" />
								) : isLinked ? (
									<CheckCircle2Icon className="size-6 text-success" />
								) : (
									<Button
										variant={isLinked ? "outline" : "light"}
										onClick={() =>
											linkProvider(
												provider as OAuthProvider,
											)
										}
									>
										<LinkIcon className="mr-1.5 size-4" />
										<span>
											{t(
												"settings.account.security.connectedAccounts.connect",
											)}
										</span>
									</Button>
								)}
							</div>
						);
					},
				)}
			</div>
		</SettingsItem>
	);
}
