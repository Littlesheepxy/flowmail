"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { useAuthErrorMessages } from "@saas/auth/hooks/errors-messages";
import { sessionQueryKey } from "@saas/auth/lib/api";
import { OrganizationInvitationAlert } from "@saas/organizations/components/OrganizationInvitationAlert";
import { useRouter } from "@shared/hooks/router";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
} from "@ui/components/form";
import { Input } from "@ui/components/input";
import {
	AlertTriangleIcon,
	ArrowRightIcon,
	EyeIcon,
	EyeOffIcon,
	KeyIcon,
	MailboxIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { withQuery } from "ufo";
import { z } from "zod";
import {
	type OAuthProvider,
	oAuthProviders,
} from "../constants/oauth-providers";
import { useSession } from "../hooks/use-session";
import { LoginModeSwitch } from "./LoginModeSwitch";
import { SocialSigninButton } from "./SocialSigninButton";

const formSchema = z.union([
	z.object({
		mode: z.literal("magic-link"),
		email: z.string().email(),
	}),
	z.object({
		mode: z.literal("password"),
		email: z.string().email(),
		password: z.string().min(1),
	}),
]);

type FormValues = z.infer<typeof formSchema>;

export function LoginForm() {
	const t = useTranslations();
	const { getAuthErrorMessage } = useAuthErrorMessages();
	const router = useRouter();
	const queryClient = useQueryClient();
	const searchParams = useSearchParams();
	const { user, loaded: sessionLoaded } = useSession();

	const [showPassword, setShowPassword] = useState(false);
	const invitationId = searchParams.get("invitationId");
	const email = searchParams.get("email");
	const redirectTo = searchParams.get("redirectTo");

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: email ?? "",
			password: "",
			mode: config.auth.enablePasswordLogin ? "password" : "magic-link",
		},
	});

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: (redirectTo ?? config.auth.redirectAfterSignIn);

	useEffect(() => {
		if (sessionLoaded && user) {
			router.replace(redirectPath);
		}
	}, [user, sessionLoaded]);

	const onSubmit: SubmitHandler<FormValues> = async (values) => {
		try {
			if (values.mode === "password") {
				const { data, error } = await authClient.signIn.email({
					...values,
				});

				if (error) {
					throw error;
				}

				if ((data as any).twoFactorRedirect) {
					router.replace(
						withQuery(
							"/auth/verify",
							Object.fromEntries(searchParams.entries()),
						),
					);
					return;
				}

				queryClient.invalidateQueries({
					queryKey: sessionQueryKey,
				});

				router.replace(redirectPath);
			} else {
				const { error } = await authClient.signIn.magicLink({
					...values,
					callbackURL: redirectPath,
				});

				if (error) {
					throw error;
				}
			}
		} catch (e) {
			form.setError("root", {
				message: getAuthErrorMessage(
					e && typeof e === "object" && "code" in e
						? (e.code as string)
						: undefined,
				),
			});
		}
	};

	const signInWithPasskey = async () => {
		try {
			await authClient.signIn.passkey();

			router.replace(redirectPath);
		} catch (e) {
			form.setError("root", {
				message: getAuthErrorMessage(
					e && typeof e === "object" && "code" in e
						? (e.code as string)
						: undefined,
				),
			});
		}
	};

	const signinMode = form.watch("mode");

	return (
		<div>
			<h1 className="font-bold text-xl md:text-2xl">
				{t("auth.login.title")}
			</h1>
			<p className="mt-1 mb-6 text-foreground/60">
				{t("auth.login.subtitle")}
			</p>

			{form.formState.isSubmitSuccessful &&
			signinMode === "magic-link" ? (
				<Alert variant="success">
					<MailboxIcon />
					<AlertTitle>
						{t("auth.login.hints.linkSent.title")}
					</AlertTitle>
					<AlertDescription>
						{t("auth.login.hints.linkSent.message")}
					</AlertDescription>
				</Alert>
			) : (
				<>
					{invitationId && (
						<OrganizationInvitationAlert className="mb-6" />
					)}

					<Form {...form}>
						<form
							className="space-y-4"
							onSubmit={form.handleSubmit(onSubmit)}
						>
							{config.auth.enableMagicLink &&
								config.auth.enablePasswordLogin && (
									<LoginModeSwitch
										activeMode={signinMode}
										onChange={(mode) =>
											form.setValue(
												"mode",
												mode as typeof signinMode,
											)
										}
									/>
								)}

							{form.formState.isSubmitted &&
								form.formState.errors.root?.message && (
									<Alert variant="error">
										<AlertTriangleIcon />
										<AlertTitle>
											{form.formState.errors.root.message}
										</AlertTitle>
									</Alert>
								)}

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
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{config.auth.enablePasswordLogin &&
								signinMode === "password" && (
									<FormField
										control={form.control}
										name="password"
										render={({ field }) => (
											<FormItem>
												<div className="flex justify-between gap-4">
													<FormLabel>
														{t(
															"auth.signup.password",
														)}
													</FormLabel>

													<Link
														href="/auth/forgot-password"
														className="text-foreground/60 text-xs"
													>
														{t(
															"auth.login.forgotPassword",
														)}
													</Link>
												</div>
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
															autoComplete="current-password"
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
											</FormItem>
										)}
									/>
								)}

							<Button
								className="w-full"
								type="submit"
								variant="secondary"
								loading={form.formState.isSubmitting}
							>
								{signinMode === "magic-link"
									? t("auth.login.sendMagicLink")
									: t("auth.login.submit")}
							</Button>
						</form>
					</Form>

					{(config.auth.enablePasskeys ||
						(config.auth.enableSignup &&
							config.auth.enableSocialLogin)) && (
						<>
							<div className="relative my-6 h-4">
								<hr className="relative top-2" />
								<p className="-translate-x-1/2 absolute top-0 left-1/2 mx-auto inline-block h-4 bg-card px-2 text-center font-medium text-foreground/60 text-sm leading-tight">
									{t("auth.login.continueWith")}
								</p>
							</div>

							<div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2">
								{config.auth.enableSignup &&
									config.auth.enableSocialLogin &&
									Object.keys(oAuthProviders).map(
										(providerId) => (
											<SocialSigninButton
												key={providerId}
												provider={
													providerId as OAuthProvider
												}
											/>
										),
									)}

								{config.auth.enablePasskeys && (
									<Button
										variant="light"
										className="w-full sm:col-span-2"
										onClick={() => signInWithPasskey()}
									>
										<KeyIcon className="mr-1.5 size-4 text-primary" />
										{t("auth.login.loginWithPasskey")}
									</Button>
								)}
							</div>
						</>
					)}

					{config.auth.enableSignup && (
						<div className="mt-6 text-center text-sm">
							<span className="text-foreground/60">
								{t("auth.login.dontHaveAnAccount")}{" "}
							</span>
							<Link
								href={withQuery(
									"/auth/signup",
									Object.fromEntries(searchParams.entries()),
								)}
							>
								{t("auth.login.createAnAccount")}
								<ArrowRightIcon className="ml-1 inline size-4 align-middle" />
							</Link>
						</div>
					)}
				</>
			)}
		</div>
	);
}
