"use client";

import { authClient } from "@repo/auth/client";
import {
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui";
import { useSession } from "@saas/auth/hooks/use-session";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { AccountSettingsModal } from "@saas/shared/components/AccountSettingsModal";
import { AdminModal } from "@saas/shared/components/AdminModal";
import { OrgSettingsModal } from "@saas/shared/components/OrgSettingsModal";
import { ColorModeToggle } from "@shared/components/ColorModeToggle";
import { UserAvatar } from "@shared/components/UserAvatar";
import {
	BookIcon,
	BuildingIcon,
	LogOutIcon,
	MoreVerticalIcon,
	SettingsIcon,
	UserCogIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { config } from "@/config";

export function UserMenu({ showUserName = true }: { showUserName?: boolean }) {
	const t = useTranslations();
	const { user } = useSession();
	const { activeOrganization, isOrganizationAdmin } = useActiveOrganization();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [adminOpen, setAdminOpen] = useState(false);
	const [orgSettingsOpen, setOrgSettingsOpen] = useState(false);

	const onLogout = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					window.location.href = new URL(
						config.saas.redirectAfterLogout,
						window.location.origin,
					).toString();
				},
			},
		});
	};

	if (!user) {
		return null;
	}

	const { name, email, image, role } = user;
	const isAdmin = role === "admin";

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className={cn(
							"flex cursor-pointer items-center gap-2 rounded-lg py-1.5 outline-hidden focus-visible:ring-2 focus-visible:ring-primary hover:bg-muted/60 transition-colors",
							showUserName ? "w-full justify-between px-2" : "justify-center p-1.5",
						)}
						aria-label="User menu"
					>
						<span className="flex items-center gap-2">
							<UserAvatar name={name ?? ""} avatarUrl={image} />
							{showUserName && (
								<span className="text-left leading-tight">
									<span className="font-medium text-sm">{name}</span>
									<span className="block text-xs opacity-70">{email}</span>
								</span>
							)}
						</span>
						{showUserName && <MoreVerticalIcon className="size-4 shrink-0 text-muted-foreground" />}
					</button>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="end" className="w-52">
					<DropdownMenuLabel>
						{name}
						<span className="block font-normal text-xs opacity-70">{email}</span>
					</DropdownMenuLabel>

					<DropdownMenuSeparator />

					{/* Color mode */}
					<DropdownMenuItem
						className="flex items-center justify-between gap-4 hover:bg-transparent focus:bg-transparent"
						onSelect={(e) => e.preventDefault()}
					>
						<span>{t("app.userMenu.colorMode")}</span>
						<ColorModeToggle />
					</DropdownMenuItem>

					<DropdownMenuSeparator />

				{/* Account Settings → Modal */}
				<DropdownMenuItem onClick={() => setSettingsOpen(true)}>
					<SettingsIcon className="mr-2 size-4" />
					{t("app.userMenu.accountSettings")}
				</DropdownMenuItem>

				{/* Organization Settings → Modal (org admin only) */}
				{activeOrganization && isOrganizationAdmin && (
					<DropdownMenuItem onClick={() => setOrgSettingsOpen(true)}>
						<BuildingIcon className="mr-2 size-4" />
						{t("app.menu.organizationSettings")}
					</DropdownMenuItem>
				)}

				{/* Admin → Modal (admin only) */}
				{isAdmin && (
					<DropdownMenuItem onClick={() => setAdminOpen(true)}>
						<UserCogIcon className="mr-2 size-4" />
						{t("app.menu.admin")}
					</DropdownMenuItem>
				)}

					<DropdownMenuSeparator />

					{config.docsLink && (
						<DropdownMenuItem asChild>
							<a href={config.docsLink}>
								<BookIcon className="mr-2 size-4" />
								{t("app.userMenu.documentation")}
							</a>
						</DropdownMenuItem>
					)}

					<DropdownMenuItem onClick={onLogout}>
						<LogOutIcon className="mr-2 size-4" />
						{t("app.userMenu.logout")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

		<AccountSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
		{isAdmin && <AdminModal open={adminOpen} onOpenChange={setAdminOpen} />}
		{activeOrganization && (
			<OrgSettingsModal open={orgSettingsOpen} onOpenChange={setOrgSettingsOpen} />
		)}
	</>
	);
}
