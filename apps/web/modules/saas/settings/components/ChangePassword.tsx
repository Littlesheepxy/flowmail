"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useRouter } from "@shared/hooks/router";
import { Button } from "@ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@ui/components/form";
import { PasswordInput } from "@ui/components/password-input";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8),
});

export function ChangePasswordForm() {
	const t = useTranslations();
	const router = useRouter();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
		},
	});

	const onSubmit = form.handleSubmit(async (values) => {
		const { error } = await authClient.changePassword({
			...values,
			revokeOtherSessions: true,
		});

		if (error) {
			toast.error(
				t(
					"settings.account.security.changePassword.notifications.error",
				),
			);

			return;
		}

		toast.success(
			t("settings.account.security.changePassword.notifications.success"),
		);
		form.reset({});
		router.refresh();
	});

	return (
		<SettingsItem
			title={t("settings.account.security.changePassword.title")}
		>
			<Form {...form}>
				<form onSubmit={onSubmit}>
					<div className="grid grid-cols-1 gap-4">
						<FormField
							control={form.control}
							name="currentPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t(
											"settings.account.security.changePassword.currentPassword",
										)}
									</FormLabel>

									<FormControl>
										<PasswordInput
											autoComplete="current-password"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="newPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t(
											"settings.account.security.changePassword.newPassword",
										)}
									</FormLabel>
									<FormControl>
										<PasswordInput
											autoComplete="new-password"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex justify-end">
							<Button
								type="submit"
								loading={form.formState.isSubmitting}
								disabled={
									!(
										form.formState.isValid &&
										Object.keys(form.formState.dirtyFields)
											.length
									)
								}
							>
								{t("settings.save")}
							</Button>
						</div>
					</div>
				</form>
			</Form>
		</SettingsItem>
	);
}
