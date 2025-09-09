"use client";
import { authClient } from "@repo/auth/client";
import { useUserPasskeysQuery } from "@saas/auth/lib/api";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Skeleton } from "@ui/components/skeleton";
import { KeyIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

export function PasskeysBlock() {
	const t = useTranslations();
	const queryClient = useQueryClient();
	const formatter = useFormatter();

	const { data: passkeys, isPending } = useUserPasskeysQuery();

	const addPasskey = async () => {
		await authClient.passkey.addPasskey({
			fetchOptions: {
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: ["passkeys"] });
					toast.success(
						t(
							"settings.account.security.passkeys.notifications.addPasskey.success.title",
						),
					);
				},
				onError: () => {
					toast.error(
						t(
							"settings.account.security.passkeys.notifications.addPasskey.error.title",
						),
					);
				},
			},
		});
	};

	const deletePasskey = (id: string) => {
		toast.promise(
			async () => {
				await authClient.passkey.deletePasskey({
					id,
				});
			},
			{
				loading: t(
					"settings.account.security.passkeys.notifications.deletePasskey.loading.title",
				),
				success: t(
					"settings.account.security.passkeys.notifications.deletePasskey.success.title",
				),
				error: t(
					"settings.account.security.passkeys.notifications.deletePasskey.error.title",
				),
			},
		);
	};

	return (
		<SettingsItem
			title={t("settings.account.security.passkeys.title")}
			description={t("settings.account.security.passkeys.description")}
		>
			<div className="grid grid-cols-1 gap-2">
				{isPending ? (
					<div className="flex gap-2">
						<Skeleton className="size-6 shrink-0" />
						<div className="flex-1">
							<Skeleton className="mb-0.5 h-4 w-full" />
							<Skeleton className="h-8 w-full" />
						</div>
						<Skeleton className="size-9 shrink-0" />
					</div>
				) : (
					passkeys?.map((passkey) => (
						<div key={passkey.id} className="flex gap-2">
							<KeyIcon className="size-6 shrink-0 text-primary/50" />
							<div className="flex-1">
								<strong className="block text-sm">
									{passkey.deviceType} {passkey.name}
								</strong>
								<small className="block text-foreground/60 text-xs leading-tight">
									{formatter.dateTime(
										new Date(passkey.createdAt),
									)}
								</small>
							</div>
							<Button
								variant="light"
								size="icon"
								className="shrink-0"
								onClick={() => deletePasskey(passkey.id)}
							>
								<TrashIcon className="size-4" />
							</Button>
						</div>
					))
				)}

				<div className="flex justify-start">
					<Button variant="light" onClick={addPasskey}>
						<PlusIcon className="mr-1.5 size-4" />
						Add passkey
					</Button>
				</div>
			</div>
		</SettingsItem>
	);
}
