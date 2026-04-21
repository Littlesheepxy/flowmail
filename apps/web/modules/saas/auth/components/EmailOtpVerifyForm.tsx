"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { Alert, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@repo/ui/components/form";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@repo/ui/components/input-otp";
import { extractAuthErrorCode, useAuthErrorMessages } from "@saas/auth/hooks/errors-messages";
import { sessionQueryKey } from "@saas/auth/lib/api";
import { useRouter } from "@shared/hooks/router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { config } from "@/config";

const formSchema = z.object({
	code: z.string().min(6).max(6),
});

export function EmailOtpVerifyForm() {
	const t = useTranslations();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { getAuthErrorMessage } = useAuthErrorMessages();
	const searchParams = useSearchParams();
	const email = searchParams.get("email") ?? "";
	const invitationId = searchParams.get("invitationId");
	const redirectTo = searchParams.get("redirectTo");
	const [resendCountdown, setResendCountdown] = useState(0);

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: (redirectTo ?? config.saas.redirectAfterSignIn);

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: {
			code: "",
		},
	});

	const onSubmit = form.handleSubmit(async ({ code }) => {
		try {
			const { error } = await authClient.signIn.emailOtp({
				email,
				otp: code,
			});

			if (error) {
				throw error;
			}

			queryClient.invalidateQueries({
				queryKey: sessionQueryKey,
			});

			router.replace(redirectPath);
		} catch (e) {
			form.setError("root", {
				message: getAuthErrorMessage(extractAuthErrorCode(e)),
			});
		}
	});

	const handleResend = async () => {
		try {
			const { error } = await authClient.emailOtp.sendVerificationOtp({
				email,
				type: "sign-in",
			});

			if (error) {
				throw error;
			}

			setResendCountdown(60);
			const timer = setInterval(() => {
				setResendCountdown((prev) => {
					if (prev <= 1) {
						clearInterval(timer);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
		} catch (e) {
			form.setError("root", {
				message: getAuthErrorMessage(extractAuthErrorCode(e)),
			});
		}
	};

	return (
		<>
			<h1 className="text-center font-bold text-xl md:text-2xl">
				{t("auth.verifyOtp.title")}
			</h1>
			<p className="mt-1 mb-6 text-center text-sm text-foreground/60">
				{t("auth.verifyOtp.message", { email })}
			</p>

			<Form {...form}>
				<form
					className="flex flex-col items-stretch gap-4"
					onSubmit={onSubmit}
				>
					{form.formState.errors.root && (
						<Alert variant="error">
							<AlertTriangleIcon />
							<AlertTitle>
								{form.formState.errors.root.message}
							</AlertTitle>
						</Alert>
					)}

					<FormField
						control={form.control}
						name="code"
						render={({ field }) => (
							<FormItem className="flex flex-col items-center">
								<FormControl>
									<InputOTP
										maxLength={6}
										{...field}
										autoComplete="one-time-code"
										onChange={(value) => {
											field.onChange(value);
											if (value.length === 6) {
												onSubmit();
											}
										}}
									>
										<InputOTPGroup>
											<InputOTPSlot
												className="size-10 text-lg"
												index={0}
											/>
											<InputOTPSlot
												className="size-10 text-lg"
												index={1}
											/>
											<InputOTPSlot
												className="size-10 text-lg"
												index={2}
											/>
										</InputOTPGroup>
										<InputOTPSeparator className="opacity-40" />
										<InputOTPGroup>
											<InputOTPSlot
												className="size-10 text-lg"
												index={3}
											/>
											<InputOTPSlot
												className="size-10 text-lg"
												index={4}
											/>
											<InputOTPSlot
												className="size-10 text-lg"
												index={5}
											/>
										</InputOTPGroup>
									</InputOTP>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button loading={form.formState.isSubmitting}>
						{t("auth.verifyOtp.submit")}
					</Button>

					<Button
						type="button"
						variant="ghost"
						disabled={resendCountdown > 0}
						onClick={handleResend}
						className="text-sm"
					>
						{resendCountdown > 0
							? t("auth.verifyOtp.resendCountdown", {
									seconds: resendCountdown,
								})
							: t("auth.verifyOtp.resend")}
					</Button>
				</form>
			</Form>

			<div className="mt-6 text-center text-sm">
				<Link href="/auth/login">
					<ArrowLeftIcon className="mr-1 inline size-4 align-middle" />
					{t("auth.verifyOtp.backToSignin")}
				</Link>
			</div>
		</>
	);
}
