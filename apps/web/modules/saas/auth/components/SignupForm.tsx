"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { config as authConfig } from "@repo/auth/config";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { extractAuthErrorCode, useAuthErrorMessages } from "@saas/auth/hooks/errors-messages";
import { OrganizationInvitationAlert } from "@saas/organizations/components/OrganizationInvitationAlert";
import {
	AlertTriangleIcon,
	ArrowRightIcon,
	EyeIcon,
	EyeOffIcon,
	MailboxIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { withQuery } from "ufo";
import { z } from "zod";
import { config } from "@/config";
import { useSession } from "@/modules/saas/auth/hooks/use-session";
import {
	type OAuthProvider,
	oAuthProviders,
} from "../constants/oauth-providers";
import { SocialSigninButton } from "./SocialSigninButton";

export function SignupForm({ prefillEmail }: { prefillEmail?: string }) {
	const t = useTranslations();
	const locale = useLocale();
	const router = useRouter();
	const { user, loaded: sessionLoaded } = useSession();
	const { getAuthErrorMessage } = useAuthErrorMessages();
	const searchParams = useSearchParams();

	const [showPassword, setShowPassword] = useState(false);
	const invitationId = searchParams.get("invitationId");
	const email = searchParams.get("email");
	const redirectTo = searchParams.get("redirectTo");

	const requireInviteField =
		config.marketing.inviteCodeRequired && !invitationId;

	const formSchema = useMemo(
		() =>
			z.object({
					name: z.string().min(1),
					email: z.string().email(),
					password: z
						.string()
						.min(8, t("auth.signup.passwordTooShort")),
					inviteCode: requireInviteField
						? z
								.string()
								.min(1, t("auth.signup.inviteCodeRequired"))
								.trim()
						: z.string().optional(),
				}),
		[requireInviteField, t],
	);

	const form = useForm({
		resolver: zodResolver(formSchema),
		values: {
			name: "",
			email: prefillEmail ?? email ?? "",
			password: "",
			inviteCode: "",
		},
	});

	useEffect(() => {
		if (invitationId || typeof sessionStorage === "undefined") {
			return;
		}
		const stored = sessionStorage.getItem("flowmail_invite_code");
		if (stored) {
			form.setValue("inviteCode", stored);
		}
	}, [invitationId, form]);

	const invitationOnlyMode = !authConfig.enableSignup && invitationId;

	const showOAuthOnSignup =
		authConfig.enableSignup &&
		authConfig.enableSocialLogin &&
		!requireInviteField;

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: (redirectTo ?? config.saas.redirectAfterSignIn);

	useEffect(() => {
		if (sessionLoaded && user) {
			router.replace(redirectPath);
		}
	}, [user, sessionLoaded]);

	const onSubmit = form.handleSubmit(
		async ({ email, password, name, inviteCode }) => {
		try {
			const payload: {
				email: string;
				password: string;
				name: string;
				callbackURL: string;
				inviteCode?: string;
			} = {
				email,
				password,
				name,
				callbackURL: redirectPath,
			};
			const trimmed = inviteCode?.trim();
			if (trimmed) {
				payload.inviteCode = trimmed;
			}

			const { error } = await authClient.signUp.email(
				payload as typeof payload & { inviteCode?: string },
			);

			if (error) {
				throw error;
			}

			if (typeof sessionStorage !== "undefined") {
				sessionStorage.removeItem("flowmail_invite_code");
			}

			if (invitationOnlyMode) {
				const { error } =
					await authClient.organization.acceptInvitation({
						invitationId,
					});

				if (error) {
					throw error;
				}

				router.push(config.saas.redirectAfterSignIn);
			}
			// 注册成功后 better-auth 会发验证邮件，session 不会立即建立。
			// isSubmitSuccessful 会触发成功 Alert，无需手动跳转。
		} catch (e) {
			const code = extractAuthErrorCode(e);
			form.setError("root", {
				message: getAuthErrorMessage(code),
			});
		}
		},
	);

	return (
		<div>
			<h1 className="font-bold text-xl md:text-2xl">
				{t("auth.signup.title")}
			</h1>
			<p className="mt-1 mb-6 text-foreground/60">
				{t("auth.signup.message")}
			</p>

			{form.formState.isSubmitSuccessful && !invitationOnlyMode ? (
				<Alert variant="success">
					<MailboxIcon />
					<AlertTitle>
						{t("auth.signup.hints.verifyEmail")}
					</AlertTitle>
				</Alert>
			) : (
				<>
					{invitationId && (
						<OrganizationInvitationAlert className="mb-6" />
					)}

					<Form {...form}>
						<form
							className="flex flex-col items-stretch gap-4"
							onSubmit={onSubmit}
						>
							{form.formState.isSubmitted &&
								form.formState.errors.root && (
									<Alert variant="error">
										<AlertTriangleIcon />
										<AlertDescription>
											{form.formState.errors.root.message}
										</AlertDescription>
									</Alert>
								)}

							{requireInviteField && (
								<FormField
									control={form.control}
									name="inviteCode"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												{t("auth.signup.inviteCode")}
											</FormLabel>
											<FormControl>
												<Input
													{...field}
													autoComplete="off"
													placeholder={t(
														"auth.signup.inviteCodePlaceholder",
													)}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							)}

							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{t("auth.signup.name")}
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{t("auth.signup.email")}
										</FormLabel>
										<FormControl>
											<Input
												{...field}
												autoComplete="email"
												readOnly={!!prefillEmail}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* 注册始终需要密码字段：better-auth emailAndPassword.enabled=true。
							    enablePasswordLogin 只控制登录页的密码入口，不影响注册。 */}
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{t("auth.signup.password")}
										</FormLabel>
										<FormControl>
											<div className="relative">
												<Input
													type={
														showPassword
															? "text"
															: "password"
													}
													className="pr-10"
													{...field}
													autoComplete="new-password"
												/>
												<button
													type="button"
													onClick={() =>
														setShowPassword(
															!showPassword,
														)
													}
													className="absolute inset-y-0 right-0 flex items-center pr-4 text-primary text-xl"
												>
													{showPassword ? (
														<EyeOffIcon className="size-4" />
													) : (
														<EyeIcon className="size-4" />
													)}
												</button>
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<Button
								variant="primary"
								loading={form.formState.isSubmitting}
							>
								{t("auth.signup.submit")}
							</Button>
						</form>
					</Form>

					{showOAuthOnSignup && (
							<>
								<div className="relative my-6 h-4">
									<hr className="relative top-2" />
									<p className="-translate-x-1/2 absolute top-0 left-1/2 mx-auto inline-block h-4 bg-card px-2 text-center font-medium text-foreground/60 text-sm leading-tight">
										{t("auth.login.continueWith")}
									</p>
								</div>

								<div className="flex flex-col items-stretch gap-2">
									{Object.keys(oAuthProviders).map(
										(providerId) => (
											<SocialSigninButton
												key={providerId}
												className="w-full"
												provider={
													providerId as OAuthProvider
												}
											/>
										),
									)}
								</div>
							</>
						)}
				</>
			)}

			<div className="mt-6 text-center text-sm">
				<span className="text-foreground/60">
					{t("auth.signup.alreadyHaveAccount")}{" "}
				</span>
				<Link
					href={withQuery("/auth/login", {
						...Object.fromEntries(searchParams.entries()),
						locale,
					})}
				>
					{t("auth.signup.signIn")}
					<ArrowRightIcon className="ml-1 inline size-4 align-middle" />
				</Link>
			</div>
		</div>
	);
}
