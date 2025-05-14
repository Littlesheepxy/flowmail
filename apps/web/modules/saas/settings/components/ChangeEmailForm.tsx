"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { useSession } from "@saas/auth/hooks/use-session";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	email: z.string().email(),
});

type FormSchema = z.infer<typeof formSchema>;

export function ChangeEmailForm() {
	const { user, reloadSession } = useSession();
	const t = useTranslations();

	const form = useForm<FormSchema>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: user?.email ?? "",
		},
	});

	const onSubmit = form.handleSubmit(async ({ email }) => {
		const { error } = await authClient.changeEmail({
			newEmail: email,
		});

		if (error) {
			toast.error(t("settings.account.changeEmail.notifications.error"));
			return;
		}

		toast.success(t("settings.account.changeEmail.notifications.success"));

		reloadSession();
	});

	return (
		<SettingsItem
			title={t("settings.account.changeEmail.title")}
			description={t("settings.account.changeEmail.description")}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					onSubmit();
				}}
			>
				<Input type="email" {...form.register("email")} />

				<div className="mt-4 flex justify-end">
					<Button
						type="submit"
						loading={form.formState.isSubmitting}
						disabled={
							!(
								form.formState.isValid &&
								form.formState.dirtyFields.email
							)
						}
					>
						{t("settings.save")}
					</Button>
				</div>
			</form>
		</SettingsItem>
	);
}
