"use client";
import { authClient } from "@repo/auth/client";
import { useSession } from "@saas/auth/hooks/use-session";
import { useUserAccountsQuery } from "@saas/auth/lib/api";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { FormItem } from "@ui/components/form";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import { PasswordInput } from "@ui/components/password-input";
import {
	ArrowRightIcon,
	CheckIcon,
	ShieldCheckIcon,
	TabletSmartphoneIcon,
	XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";

export function TwoFactorBlock() {
	const t = useTranslations();
	const { user, reloadSession } = useSession();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogView, setDialogView] = useState<"password" | "totp-url">(
		"password",
	);
	const [totpURI, setTotpURI] = useState("");
	const [password, setPassword] = useState("");
	const [totpCode, setTotpCode] = useState("");

	const { data: accounts } = useUserAccountsQuery();

	useEffect(() => {
		setPassword("");
	}, [dialogOpen]);

	const totpURISecret = useMemo(() => {
		if (!totpURI) {
			return null;
		}

		const url = new URL(totpURI);
		return url.searchParams.get("secret") || null;
	}, [totpURI]);

	const verifyPassword = async () => {
		setDialogView("password");
		setDialogOpen(true);
	};

	const enableTwoFactorMutation = useMutation({
		mutationKey: ["enableTwoFactor"],
		mutationFn: async () => {
			const { data, error } = await authClient.twoFactor.enable({
				password,
			});

			if (error) {
				throw error;
			}

			setTotpURI(data.totpURI);
			setDialogView("totp-url");
		},

		onError: () => {
			toast.error(
				t(
					"settings.account.security.twoFactor.notifications.enable.error.title",
				),
			);
		},
	});

	const disableTwoFactorMutation = useMutation({
		mutationKey: ["disableTwoFactor"],
		mutationFn: async () => {
			const { error } = await authClient.twoFactor.disable({
				password,
			});

			if (error) {
				throw error;
			}

			setDialogOpen(false);

			toast.success(
				t(
					"settings.account.security.twoFactor.notifications.disable.success.title",
				),
			);

			reloadSession();
		},

		onError: () => {
			toast.error(
				t(
					"settings.account.security.twoFactor.notifications.enable.error.title",
				),
			);
		},
	});

	const verifyTwoFactorMutation = useMutation({
		mutationKey: ["verifyTwoFactor"],
		mutationFn: async () => {
			const { error } = await authClient.twoFactor.verifyTotp({
				code: totpCode,
			});

			if (error) {
				throw error;
			}

			toast.success(
				t(
					"settings.account.security.twoFactor.notifications.verify.success.title",
				),
			);

			reloadSession();
			setDialogOpen(false);
		},
	});

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (user?.twoFactorEnabled) {
			disableTwoFactorMutation.mutate();
			return;
		}

		if (dialogView === "password") {
			enableTwoFactorMutation.mutate();
			return;
		}

		verifyTwoFactorMutation.mutate();
	};

	if (!accounts?.some((account) => account.provider === "credential")) {
		return null;
	}

	return (
		<SettingsItem
			title={t("settings.account.security.twoFactor.title")}
			description={t("settings.account.security.twoFactor.description")}
		>
			{user?.twoFactorEnabled ? (
				<div className="flex items-start flex-col gap-4">
					<div className="flex items-center gap-1.5">
						<ShieldCheckIcon className="size-6 text-green-500" />
						<p className="text-sm text-foreground">
							{t("settings.account.security.twoFactor.enabled")}
						</p>
					</div>
					<Button variant="light" onClick={verifyPassword}>
						<XIcon className="mr-1.5 size-4" />
						{t("settings.account.security.twoFactor.disable")}
					</Button>
				</div>
			) : (
				<div className="flex justify-start">
					<Button variant="light" onClick={verifyPassword}>
						<TabletSmartphoneIcon className="mr-1.5 size-4" />
						{t("settings.account.security.twoFactor.enable")}
					</Button>
				</div>
			)}

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{dialogView === "password"
								? t(
										"settings.account.security.twoFactor.dialog.password.title",
									)
								: t(
										"settings.account.security.twoFactor.dialog.totpUrl.title",
									)}
						</DialogTitle>
					</DialogHeader>

					{dialogView === "password" ? (
						<form onSubmit={handleSubmit}>
							<div className="grid grid-cols-1 gap-4">
								<p className="text-sm text-foreground/60">
									{t(
										"settings.account.security.twoFactor.dialog.password.description",
									)}
								</p>

								<FormItem>
									<Label className="block">
										{t(
											"settings.account.security.twoFactor.dialog.password.label",
										)}
									</Label>
									<PasswordInput
										value={password}
										onChange={(value) => setPassword(value)}
									/>
								</FormItem>
							</div>
							<div className="mt-4">
								<Button
									type="submit"
									variant="secondary"
									className="w-full"
									loading={
										enableTwoFactorMutation.isPending ||
										disableTwoFactorMutation.isPending
									}
								>
									{t("common.actions.continue")}
									<ArrowRightIcon className="ml-1.5 size-4" />
								</Button>
							</div>
						</form>
					) : (
						<form onSubmit={handleSubmit}>
							<div className="grid grid-cols-1 gap-4">
								<p className="text-sm text-foreground/60">
									{t(
										"settings.account.security.twoFactor.dialog.totpUrl.description",
									)}
								</p>
								<Card className="flex flex-col items-center gap-4 p-6">
									<QRCode title={totpURI} value={totpURI} />

									{totpURISecret && (
										<p className="text-xs text-muted-foreground text-center">
											{totpURISecret}
										</p>
									)}
								</Card>

								<hr />

								<div className="grid grid-cols-1 gap-4">
									<FormItem>
										<Label className="block">
											{t(
												"settings.account.security.twoFactor.dialog.totpUrl.code",
											)}
										</Label>
										<Input
											value={totpCode}
											onChange={(e) =>
												setTotpCode(e.target.value)
											}
										/>
									</FormItem>
								</div>
							</div>
							<div className="mt-4">
								<Button
									type="submit"
									variant="secondary"
									className="w-full"
									loading={verifyTwoFactorMutation.isPending}
								>
									<CheckIcon className="mr-1.5 size-4" />
									{t("common.actions.verify")}
								</Button>
							</div>
						</form>
					)}
				</DialogContent>
			</Dialog>
		</SettingsItem>
	);
}
