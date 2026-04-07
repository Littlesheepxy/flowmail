"use client";

import { Button } from "@repo/ui/components/button";
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

export function ExportDataForm() {
	const t = useTranslations();
	const { activeOrganization } = useActiveOrganization();

	const exportMutation = useMutation(
		orpc.users.exportData.mutationOptions({
			onSuccess: (data) => {
				const blob = new Blob([JSON.stringify(data, null, 2)], {
					type: "application/json",
				});
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `flowmail-export-${new Date().toISOString().slice(0, 10)}.json`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				toastSuccess(
					t("settings.privacy.exportData.notifications.success"),
				);
			},
			onError: () => {
				toastError(
					t("settings.privacy.exportData.notifications.error"),
				);
			},
		}),
	);

	return (
		<SettingsItem
			title={t("settings.privacy.exportData.title")}
			description={t("settings.privacy.exportData.description")}
		>
			<div className="mt-4 flex justify-end">
				<Button
					variant="outline"
					onClick={() => {
						if (!activeOrganization?.id) {
							return;
						}
						exportMutation.mutate({
							organizationId: activeOrganization.id,
							includeEmails: true,
							includeEntities: true,
							includeTimeline: true,
						});
					}}
					disabled={
						exportMutation.isPending || !activeOrganization?.id
					}
				>
					{exportMutation.isPending ? (
						<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<DownloadIcon className="mr-2 h-4 w-4" />
					)}
					{t("settings.privacy.exportData.submit")}
				</Button>
			</div>
		</SettingsItem>
	);
}
