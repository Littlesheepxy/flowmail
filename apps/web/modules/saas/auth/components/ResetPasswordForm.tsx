"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import { AlertTriangleIcon, ArrowLeftIcon, MailboxIcon } from "lucide-react";

import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { useSession } from "@saas/auth/hooks/use-session";
import { useRouter } from "@shared/hooks/router";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
} from "@ui/components/form";
import { PasswordInput } from "@ui/components/password-input";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
	password: z.string().min(8),
});

type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordForm() {
	const t = useTranslations();
	const { user } = useSession();
	const router = useRouter();
	const [serverError, setServerError] = useState<null | {
		title: string;
		message?: string;
	}>(null);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			password: "",
		},
	});

	const onSubmit = form.handleSubmit(async ({ password }) => {
		try {
			const { error } = await authClient.resetPassword({
				newPassword: password,
			});

			if (error) {
				throw error;
			}

			if (user) {
				router.push(config.auth.redirectAfterSignIn);
			}
		} catch (e) {
			setServerError({
				title: t("auth.resetPassword.hints.error"),
			});
		}
	});

	return (
		<>
			<h1 className="font-extrabold text-2xl md:text-3xl">
				{t("auth.resetPassword.title")}
			</h1>
			<p className="mt-1 mb-6 text-foreground/60">
				{t("auth.resetPassword.message")}{" "}
			</p>

			{form.formState.isSubmitSuccessful ? (
				<Alert variant="success">
					<MailboxIcon className="size-6" />
					<AlertTitle>
						{t("auth.resetPassword.hints.success")}
					</AlertTitle>
				</Alert>
			) : (
				<Form {...form}>
					<form
						className="flex flex-col items-stretch gap-4"
						onSubmit={onSubmit}
					>
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t("auth.resetPassword.newPassword")}
									</FormLabel>
									<FormControl>
										<PasswordInput
											autoComplete="new-password"
											{...field}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						{form.formState.isSubmitted && serverError && (
							<Alert variant="error">
								<AlertTriangleIcon className="size-6" />
								<AlertTitle>{serverError.title}</AlertTitle>
								{serverError.message && (
									<AlertDescription>
										{serverError.message}
									</AlertDescription>
								)}
							</Alert>
						)}

						<Button loading={form.formState.isSubmitting}>
							{t("auth.resetPassword.submit")}
						</Button>
					</form>
				</Form>
			)}

			<div className="mt-6 text-center text-sm">
				<Link href="/auth/login">
					<ArrowLeftIcon className="mr-1 inline size-4 align-middle" />
					{t("auth.resetPassword.backToSignin")}
				</Link>
			</div>
		</>
	);
}
