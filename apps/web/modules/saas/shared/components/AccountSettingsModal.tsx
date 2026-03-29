"use client";

import { config as authConfig } from "@repo/auth/config";
import { config as paymentsConfig } from "@repo/payments/config";
import { ActiveSessionsBlock } from "@saas/settings/components/ActiveSessionsBlock";
import { ChangeEmailForm } from "@saas/settings/components/ChangeEmailForm";
import { ChangeNameForm } from "@saas/settings/components/ChangeNameForm";
import { ChangePasswordForm } from "@saas/settings/components/ChangePassword";
import { ConnectedAccountsBlock } from "@saas/settings/components/ConnectedAccountsBlock";
import { DeleteAccountForm } from "@saas/settings/components/DeleteAccountForm";
import { PasskeysBlock } from "@saas/settings/components/PasskeysBlock";
import { TwoFactorBlock } from "@saas/settings/components/TwoFactorBlock";
import { UserAvatarForm } from "@saas/settings/components/UserAvatarForm";
import { ActivePlan } from "@saas/payments/components/ActivePlan";
import { ChangePlan } from "@saas/payments/components/ChangePlan";
import { useSession } from "@saas/auth/hooks/use-session";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { SettingsList } from "@saas/shared/components/SettingsList";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { cn } from "@repo/ui";
import {
	CreditCardIcon,
	LockKeyholeIcon,
	SettingsIcon,
	TriangleAlertIcon,
	XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface AccountSettingsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type SettingsTab = "general" | "security" | "billing" | "danger-zone";

export function AccountSettingsModal({
	open,
	onOpenChange,
}: AccountSettingsModalProps) {
	const t = useTranslations();
	const [activeTab, setActiveTab] = useState<SettingsTab>("general");
	const { user } = useSession();
	const { activePlan } = usePurchases();

	const showBilling = paymentsConfig.billingAttachedTo === "user";

	const menuItems = [
		{
			id: "general" as const,
			title: t("settings.menu.account.general"),
			icon: SettingsIcon,
		},
		{
			id: "security" as const,
			title: t("settings.menu.account.security"),
			icon: LockKeyholeIcon,
		},
		...(showBilling
			? [
					{
						id: "billing" as const,
						title: t("settings.menu.account.billing"),
						icon: CreditCardIcon,
					},
				]
			: []),
		{
			id: "danger-zone" as const,
			title: t("settings.menu.account.dangerZone"),
			icon: TriangleAlertIcon,
		},
	];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[700px]! max-w-[90vw]! h-[560px] max-h-[88vh] p-0 gap-0 rounded-2xl overflow-hidden [&>button]:hidden">
				<DialogTitle className="sr-only">
					{t("settings.account.title")}
				</DialogTitle>

				<button
					type="button"
					onClick={() => onOpenChange(false)}
					className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
				>
					<XIcon className="size-4" />
				</button>

				<div className="flex h-full w-full overflow-hidden">
					{/* Left sidebar */}
					<div className="w-[160px] shrink-0 bg-muted/30 p-3 overflow-y-auto border-r border-border/50">
						<div className="mb-3 px-2 pt-1">
							<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
								{t("settings.account.title")}
							</p>
						</div>
						<nav className="space-y-0.5">
							{menuItems.map((item) => {
								const Icon = item.icon;
								return (
									<button
										key={item.id}
										type="button"
										onClick={() => setActiveTab(item.id)}
										className={cn(
											"flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-all",
											activeTab === item.id
												? "bg-background text-foreground font-medium shadow-sm"
												: "text-muted-foreground hover:bg-background/60 hover:text-foreground",
										)}
									>
										<Icon className="size-4 shrink-0" />
										<span className="truncate">{item.title}</span>
									</button>
								);
							})}
						</nav>
					</div>

					{/* Right content */}
					<div className="flex-1 min-w-0 flex flex-col overflow-hidden">
						<div className="px-6 pt-5 pb-3 shrink-0 border-b border-border/50">
							<h2 className="text-base font-semibold">
								{menuItems.find((item) => item.id === activeTab)?.title}
							</h2>
						</div>

						<div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
							{activeTab === "general" && (
								<SettingsList>
									<UserAvatarForm />
									<ChangeNameForm />
									<ChangeEmailForm />
								</SettingsList>
							)}

							{activeTab === "security" && (
								<SettingsList>
									{authConfig.enablePasswordLogin && (
										<ChangePasswordForm />
									)}
									{authConfig.enableSocialLogin && <ConnectedAccountsBlock />}
									{authConfig.enablePasskeys && <PasskeysBlock />}
									{authConfig.enableTwoFactor && <TwoFactorBlock />}
									<ActiveSessionsBlock />
								</SettingsList>
							)}

						{activeTab === "billing" && (
							<SettingsList>
								{activePlan && <ActivePlan />}
								<ChangePlan
									userId={user?.id}
									activePlanId={activePlan?.id}
								/>
							</SettingsList>
						)}

						{activeTab === "danger-zone" && (
							<SettingsList>
								<DeleteAccountForm />
							</SettingsList>
						)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
