"use client";
import { authClient } from "@repo/auth/client";
import { useSession } from "@saas/auth/hooks/use-session";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useRouter } from "@shared/hooks/router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Skeleton } from "@ui/components/skeleton";
import { ComputerIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function ActiveSessionsBlock() {
	const t = useTranslations();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { session: currentSession } = useSession();

	const { data: sessions, isPending } = useQuery({
		queryKey: ["active-sessions"],
		queryFn: async () => {
			const { data, error } = await authClient.listSessions();

			if (error) {
				throw error;
			}

			return data;
		},
	});

	const revokeSession = (token: string) => {
		authClient.revokeSession(
			{
				token,
			},
			{
				onSuccess: () => {
					toast.success(
						t(
							"settings.account.security.activeSessions.notifications.revokeSession.success",
						),
					);

					queryClient.invalidateQueries({
						queryKey: ["active-sessions"],
					});

					router.refresh();
				},
			},
		);
	};

	return (
		<SettingsItem
			title={t("settings.account.security.activeSessions.title")}
			description={t(
				"settings.account.security.activeSessions.description",
			)}
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
					sessions?.map((session) => (
						<div
							key={session.id}
							className="flex justify-between gap-4"
						>
							<div className="flex gap-2">
								<ComputerIcon className="size-6 shrink-0 text-primary/50" />
								<div>
									<strong className="block text-sm">
										{session.id === currentSession?.id
											? t(
													"settings.account.security.activeSessions.currentSession",
												)
											: session.ipAddress}
									</strong>
									<small className="block text-foreground/60 text-xs leading-tight">
										{session.userAgent}
									</small>
								</div>
							</div>
							<Button
								variant="light"
								size="icon"
								className="shrink-0"
								onClick={() => revokeSession(session.token)}
							>
								<XIcon className="size-4" />
							</Button>
						</div>
					))
				)}
			</div>
		</SettingsItem>
	);
}
