"use client";
import { authClient } from "@repo/auth/client";
import { useSession } from "@saas/auth/hooks/use-session";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { Button } from "@ui/components/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

export function SetPasswordForm() {
	const t = useTranslations();
	const { user } = useSession();
	const [submitting, setSubmitting] = useState(false);

	const onSubmit = async () => {
		if (!user) {
			return;
		}

		setSubmitting(true);

		await authClient.forgetPassword(
			{
				email: user.email,
				redirectTo: `${window.location.origin}/auth/reset-password`,
			},
			{
				onSuccess: () => {
					toast.success(
						t(
							"settings.account.security.setPassword.notifications.success",
						),
					);
				},
				onError: () => {
					toast.error(
						t(
							"settings.account.security.setPassword.notifications.error",
						),
					);
				},
				onResponse: () => {
					setSubmitting(false);
				},
			},
		);
	};

	return (
		<SettingsItem
			title={t("settings.account.security.setPassword.title")}
			description={t("settings.account.security.setPassword.description")}
		>
			<div className="flex justify-end">
				<Button type="submit" loading={submitting} onClick={onSubmit}>
					{t("settings.account.security.setPassword.submit")}
				</Button>
			</div>
		</SettingsItem>
	);
}
