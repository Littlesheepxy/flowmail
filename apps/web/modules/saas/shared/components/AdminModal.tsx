"use client";

import { UserList } from "@saas/admin/component/users/UserList";
import { OrganizationList } from "@saas/admin/component/organizations/OrganizationList";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { cn } from "@repo/ui";
import { BuildingIcon, UsersIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface AdminModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type AdminTab = "users" | "organizations";

export function AdminModal({ open, onOpenChange }: AdminModalProps) {
	const t = useTranslations();
	const [activeTab, setActiveTab] = useState<AdminTab>("users");

	const menuItems = [
		{
			id: "users" as const,
			title: t("admin.users.title"),
			icon: UsersIcon,
		},
		{
			id: "organizations" as const,
			title: t("admin.organizations.title"),
			icon: BuildingIcon,
		},
	];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[860px]! max-w-[92vw]! h-[640px] max-h-[90vh] p-0 gap-0 rounded-2xl overflow-hidden [&>button]:hidden">
				<DialogTitle className="sr-only">
					{t("app.menu.admin")}
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
								{t("app.menu.admin")}
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
							{activeTab === "users" && <UserList />}
							{activeTab === "organizations" && <OrganizationList />}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
