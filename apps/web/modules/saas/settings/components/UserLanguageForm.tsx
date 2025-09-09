"use client";

import { updateLocale } from "@i18n/lib/update-locale";
import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import type { Locale } from "@repo/i18n";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useMutation } from "@tanstack/react-query";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const { locales } = config.i18n;

export function UserLanguageForm() {
	const currentLocale = useLocale();
	const t = useTranslations();
	const router = useRouter();
	const [locale, setLocale] = useState<Locale | undefined>(
		currentLocale as Locale,
	);

	const updateLocaleMutation = useMutation({
		mutationFn: async () => {
			if (!locale) {
				return;
			}

			await authClient.updateUser({
				locale,
			});
			await updateLocale(locale);
			router.refresh();
		},
	});

	const saveLocale = async () => {
		try {
			await updateLocaleMutation.mutateAsync();

			toast.success(t("settings.account.language.notifications.success"));
		} catch {
			toast.error(t("settings.account.language.notifications.error"));
		}
	};

	return (
		<SettingsItem
			title={t("settings.account.language.title")}
			description={t("settings.account.language.description")}
		>
			<Select
				value={locale}
				onValueChange={(value) => {
					setLocale(value as Locale);
					saveLocale();
				}}
				disabled={updateLocaleMutation.isPending}
			>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{Object.entries(locales).map(([key, value]) => (
						<SelectItem key={key} value={key}>
							{value.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</SettingsItem>
	);
}
