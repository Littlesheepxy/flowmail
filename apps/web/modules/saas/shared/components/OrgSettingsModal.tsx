"use client";

import { config as paymentsConfig } from "@repo/payments/config";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { ChangeOrganizationNameForm } from "@saas/organizations/components/ChangeOrganizationNameForm";
import { OrganizationLogoForm } from "@saas/organizations/components/OrganizationLogoForm";
import { InviteMemberForm } from "@saas/organizations/components/InviteMemberForm";
import { OrganizationMembersBlock } from "@saas/organizations/components/OrganizationMembersBlock";
import { DeleteOrganizationForm } from "@saas/organizations/components/DeleteOrganizationForm";
import { ActivePlan } from "@saas/payments/components/ActivePlan";
import { ChangePlan } from "@saas/payments/components/ChangePlan";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { SettingsList } from "@saas/shared/components/SettingsList";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { cn } from "@repo/ui";
import {
	BuildingIcon,
	CreditCardIcon,
	TriangleAlertIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export type OrgTab = "general" | "members" | "billing" | "danger-zone";

interface OrgSettingsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	defaultTab?: OrgTab;
}

export function OrgSettingsModal({ open, onOpenChange, defaultTab }: OrgSettingsModalProps) {
	const t = useTranslations();
	const [activeTab, setActiveTab] = useState<OrgTab>(defaultTab ?? "general");

	useEffect(() => {
		if (open && defaultTab) {
			setActiveTab(defaultTab);
		}
	}, [open, defaultTab]);

	const { activeOrganization, isOrganizationAdmin } = useActiveOrganization();
	const { activePlan } = usePurchases(activeOrganization?.id);

	const showBilling = paymentsConfig.billingAttachedTo === "organization";

	const menuItems = [
		{
			id: "general" as const,
			title: t("settings.menu.organization.general"),
			icon: BuildingIcon,
		},
		{
			id: "members" as const,
			title: t("settings.menu.organization.members"),
			icon: UsersIcon,
		},
		...(showBilling
			? [
					{
						id: "billing" as const,
						title: t("settings.menu.organization.billing"),
						icon: CreditCardIcon,
					},
				]
			: []),
	...(isOrganizationAdmin
		? [
				{
					id: "danger-zone" as const,
					title: t("settings.menu.organization.dangerZone"),
					icon: TriangleAlertIcon,
				},
			]
		: []),
	];

	if (!activeOrganization) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-full h-full max-w-none max-h-none rounded-none md:w-[700px]! md:max-w-[90vw]! md:h-[580px] md:max-h-[88vh] md:rounded-2xl p-0 gap-0 overflow-hidden [&>button]:hidden">
				<DialogTitle className="sr-only">
					{t("organizations.settings.title")}
				</DialogTitle>

				<button
					type="button"
					onClick={() => onOpenChange(false)}
					className="absolute right-4 top-3 md:top-4 z-10 rounded-full p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
				>
					<XIcon className="size-4" />
				</button>

				<div className="flex flex-col md:flex-row h-full w-full overflow-hidden">
					{/* Navigation — horizontal tabs on mobile, vertical sidebar on desktop */}
					<div className="shrink-0 bg-muted/30 md:w-[160px] md:p-3 md:overflow-y-auto md:border-r border-b md:border-b-0 border-border/50">
						<div className="hidden md:block mb-3 px-2 pt-1">
							<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
								{t("settings.menu.organization.title")}
							</p>
							<p className="mt-0.5 truncate text-xs font-medium text-foreground/70">
								{activeOrganization.name}
							</p>
						</div>

						{/* Mobile: horizontal scroll tabs */}
						<div className="flex md:hidden items-center gap-1 px-3 pt-3 pb-2 overflow-x-auto scrollbar-none">
							<p className="shrink-0 text-xs font-medium text-foreground/70 mr-1">
								{activeOrganization.name}
							</p>
							{menuItems.map((item) => {
								const Icon = item.icon;
								return (
									<button
										key={item.id}
										type="button"
										onClick={() => setActiveTab(item.id)}
										className={cn(
											"shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all",
											activeTab === item.id
												? "bg-background text-foreground font-medium shadow-sm"
												: "text-muted-foreground hover:bg-background/60",
										)}
									>
										<Icon className="size-3.5 shrink-0" />
										<span>{item.title}</span>
									</button>
								);
							})}
						</div>

						{/* Desktop: vertical nav */}
						<nav className="hidden md:block space-y-0.5">
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

					{/* Content */}
					<div className="flex-1 min-w-0 flex flex-col overflow-hidden">
						<div className="hidden md:block px-6 pt-5 pb-3 shrink-0 border-b border-border/50">
							<h2 className="text-base font-semibold">
								{menuItems.find((item) => item.id === activeTab)?.title}
							</h2>
						</div>

						<div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-4">
							{activeTab === "general" && (
								<SettingsList>
									<OrganizationLogoForm />
									<ChangeOrganizationNameForm />
								</SettingsList>
							)}

							{activeTab === "members" && (
								<SettingsList>
									{isOrganizationAdmin && (
										<InviteMemberForm organizationId={activeOrganization.id} />
									)}
									<OrganizationMembersBlock
										organizationId={activeOrganization.id}
									/>
								</SettingsList>
							)}

							{activeTab === "billing" && (
								<SettingsList>
									{activePlan && (
										<ActivePlan organizationId={activeOrganization.id} />
									)}
									<ChangePlan
										organizationId={activeOrganization.id}
										activePlanId={activePlan?.id}
									/>
								</SettingsList>
							)}

							{activeTab === "danger-zone" && (
								<SettingsList>
									<DeleteOrganizationForm />
								</SettingsList>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
