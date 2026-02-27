"use client";
import { config as authConfig } from "@repo/auth/config";
import { config as paymentsConfig } from "@repo/payments/config";
import { cn } from "@repo/ui";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { useSession } from "@saas/auth/hooks/use-session";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { useOrganizationListQuery } from "@saas/organizations/lib/api";
import { usePlanData } from "@saas/payments/hooks/plan-data";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useRouter } from "@shared/hooks/router";
import { clearCache } from "@shared/lib/cache";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { OrganizationLogo } from "./OrganizationLogo";

export function OrganzationSelect({
	className,
	collapsed = false,
}: {
	className?: string;
	collapsed?: boolean;
}) {
	const t = useTranslations();
	const { user } = useSession();
	const router = useRouter();
	const { activeOrganization, setActiveOrganization } =
		useActiveOrganization();
	const { data: allOrganizations } = useOrganizationListQuery();
	const { planData } = usePlanData();
	const { activePlan: orgActivePlan } = usePurchases(activeOrganization?.id);
	const { activePlan: userActivePlan } = usePurchases();

	if (!user) {
		return null;
	}

	const getPlanTitle = (planId: string | undefined) => {
		if (!planId) {
			return null;
		}
		const plan = planData[planId as keyof typeof planData];
		return plan?.title ?? null;
	};

	const triggerButton = (
		<DropdownMenuTrigger
			className={cn(
				"flex w-full items-center justify-between gap-3 text-left outline-none transition-colors",
				{
					"justify-center": collapsed,
					"px-2 py-2 rounded-lg hover:bg-muted/50": collapsed,
				},
			)}
		>
			<div
				className={cn(
					"flex flex-1 items-center gap-3 overflow-hidden",
					{
						"flex-1 flex justify-center": collapsed,
					},
				)}
			>
				{activeOrganization ? (
					<>
						<OrganizationLogo
							name={activeOrganization.name}
							logoUrl={activeOrganization.logo}
							className={cn("shrink-0 rounded-md", {
								"size-10": !collapsed,
								"size-8": collapsed,
							})}
						/>
						{!collapsed && (
							<div className="flex min-w-0 flex-1 flex-col">
								<span className="truncate text-sm font-semibold text-foreground">
									{activeOrganization.name}
								</span>
								{paymentsConfig.billingAttachedTo ===
									"organization" &&
									orgActivePlan && (
										<span className="truncate text-xs text-primary font-medium">
											{getPlanTitle(orgActivePlan.id)}
										</span>
									)}
							</div>
						)}
					</>
				) : (
					<>
						<UserAvatar
							className={cn("shrink-0", {
								"size-10": !collapsed,
								"size-8": collapsed,
							})}
							name={user.name ?? ""}
							avatarUrl={user.image}
						/>
						{!collapsed && (
							<div className="flex min-w-0 flex-1 flex-col">
								<span className="truncate text-sm font-semibold text-foreground">
									{t(
										"organizations.organizationSelect.personalAccount",
									)}
								</span>
								{paymentsConfig.billingAttachedTo === "user" &&
									userActivePlan && (
										<span className="truncate text-xs text-primary font-medium">
											{getPlanTitle(userActivePlan.id)}
										</span>
									)}
							</div>
						)}
					</>
				)}
			</div>

			{!collapsed && (
				<ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
			)}
		</DropdownMenuTrigger>
	);

	const triggerContent = collapsed ? (
		<Tooltip>
			<TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
			<TooltipContent side="right">
				{activeOrganization
					? activeOrganization.name
					: t("organizations.organizationSelect.personalAccount")}
			</TooltipContent>
		</Tooltip>
	) : (
		triggerButton
	);

	const dropdownContent = (
		<DropdownMenuContent className="w-full">
			{!authConfig.organizations.requireOrganization && (
				<>
					<DropdownMenuRadioGroup
						value={activeOrganization?.id ?? user.id}
						onValueChange={async (value: string) => {
							if (value === user.id) {
								await clearCache();
								router.replace("/app");
							}
						}}
					>
						<DropdownMenuLabel className="text-foreground/60 text-xs">
							{t(
								"organizations.organizationSelect.personalAccount",
							)}
						</DropdownMenuLabel>
						<DropdownMenuRadioItem
							value={user.id}
							className="flex cursor-pointer items-center justify-center gap-2 pl-3"
						>
							<div className="flex flex-1 items-center justify-start gap-2">
								<UserAvatar
									className="size-8"
									name={user.name ?? ""}
									avatarUrl={user.image}
								/>
								{user.name}
							</div>
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
				</>
			)}
			<DropdownMenuRadioGroup
				value={activeOrganization?.slug}
				onValueChange={async (organizationSlug: string) => {
					await clearCache();
					setActiveOrganization(organizationSlug);
				}}
			>
				<DropdownMenuLabel className="text-foreground/60 text-xs">
					{t("organizations.organizationSelect.organizations")}
				</DropdownMenuLabel>
				{allOrganizations?.map((organization) => (
					<DropdownMenuRadioItem
						key={organization.slug}
						value={organization.slug}
						className="flex cursor-pointer items-center justify-center gap-2 pl-3"
					>
						<div className="flex flex-1 items-center justify-start gap-2">
							<OrganizationLogo
								className="size-8"
								name={organization.name}
								logoUrl={organization.logo}
							/>
							{organization.name}
						</div>
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>

			{authConfig.organizations.enableUsersToCreateOrganizations && (
				<DropdownMenuGroup>
					<DropdownMenuItem
						asChild
						className="text-primary! cursor-pointer text-sm"
					>
						<Link href="/new-organization">
							<PlusIcon className="mr-2 size-6 rounded-md bg-primary/20 p-1" />
							{t(
								"organizations.organizationSelect.createNewOrganization",
							)}
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>
			)}
		</DropdownMenuContent>
	);

	const content = (
		<DropdownMenu>
			{triggerContent}
			{dropdownContent}
		</DropdownMenu>
	);

	if (collapsed) {
		return (
			<div className={className}>
				<TooltipProvider delayDuration={0}>{content}</TooltipProvider>
			</div>
		);
	}

	return <div className={className}>{content}</div>;
}
