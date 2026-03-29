"use client";

import { config as authConfig } from "@repo/auth/config";
import { Button, cn, Logo } from "@repo/ui";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { UserMenu } from "@saas/shared/components/UserMenu";
import {
	CheckCircle2Icon,
	FileTextIcon,
	HomeIcon,
	InboxIcon,
	MailIcon,
	PanelLeftCloseIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { config as webConfig } from "@/config";
import { OrganzationSelect } from "../../organizations/components/OrganizationSelect";
import { useSidebar } from "../lib/sidebar-context";

export function NavBar() {
	const pathname = usePathname();
	const { activeOrganization } = useActiveOrganization();
	const { isCollapsed, toggleCollapsed } = useSidebar();

	const bottomRef = React.useRef<HTMLDivElement>(null);
	const [spotlight, setSpotlight] = React.useState({
		x: 0,
		y: 0,
		visible: false,
	});

	const handleBottomMouseMove = (e: React.MouseEvent) => {
		if (!bottomRef.current) {
			return;
		}
		const rect = bottomRef.current.getBoundingClientRect();
		setSpotlight({
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
			visible: true,
		});
	};

	const { useSidebarLayout } = webConfig.saas;

	const basePath = activeOrganization
		? `/app/${activeOrganization.slug}`
		: "/app";

	type MenuItem = {
		label: string;
		icon: React.ElementType;
		isActive: boolean;
		href?: string;
		onClick?: () => void;
	};

	type MenuGroup = {
		groupLabel?: string;
		items: MenuItem[];
	};

	const menuGroups: MenuGroup[] = [
		{
			items: [
				{
					label: "Dashboard",
					href: basePath,
					icon: HomeIcon,
					isActive: pathname === basePath,
				},
			],
		},
		...(activeOrganization
			? [
					{
						groupLabel: "Workflow",
						items: [
							{
								label: "Inbox",
								href: `${basePath}/inbox`,
								icon: InboxIcon,
								isActive: pathname.startsWith(
									`${basePath}/inbox`,
								),
							},
							{
								label: "Approvals",
								href: `${basePath}/approvals`,
								icon: CheckCircle2Icon,
								isActive: pathname.startsWith(
									`${basePath}/approvals`,
								),
							},
							{
								label: "Reports",
								href: `${basePath}/reports`,
								icon: FileTextIcon,
								isActive: pathname.startsWith(
									`${basePath}/reports`,
								),
							},
						],
					},
					{
						groupLabel: "Settings",
						items: [
							{
								label: "Email Connections",
								href: `${basePath}/settings/email-connections`,
								icon: MailIcon,
								isActive: pathname.startsWith(
									`${basePath}/settings/email-connections`,
								),
							},
						],
					},
				]
			: []),
	];

	return (
		<nav
			className={cn("w-full", {
				"w-full md:fixed md:top-0 md:left-0 md:h-full md:transition-[width] md:duration-300 md:ease-in-out md:w-[260px]":
					useSidebarLayout,
				"md:w-[64px]": useSidebarLayout && isCollapsed,
			})}
		>
			<div
				className={cn("py-4 px-4", {
					"py-0 px-3 md:flex md:h-full md:flex-col md:pb-0":
						useSidebarLayout,
				})}
			>
				{/* ── 顶部：Logo + 折叠按钮 ── */}
				<div
					className={cn(
						"flex flex-wrap items-center justify-between gap-6",
						{
							"md:flex-col md:items-stretch md:gap-0":
								useSidebarLayout,
						},
					)}
				>
					{/* Logo 区域 */}
					<div
						className={cn("flex items-center justify-between", {
							"md:h-[56px] md:border-b md:border-border/50":
								useSidebarLayout,
							"md:justify-center":
								useSidebarLayout && isCollapsed,
						})}
					>
						{/* 展开状态：logo + 折叠按钮并排 */}
						{(!isCollapsed || !useSidebarLayout) && (
							<>
								<Link href="/app" className="block -ml-1">
									<Logo withLabel={true} />
								</Link>
								{useSidebarLayout && (
									<Button
										variant="ghost"
										size="icon"
										onClick={toggleCollapsed}
										className="ml-auto shrink-0 size-7 text-muted-foreground hover:text-foreground"
										aria-label="Collapse sidebar"
									>
										<PanelLeftCloseIcon className="size-4" />
									</Button>
								)}
							</>
						)}

						{/* 折叠状态：展开按钮 + logo */}
						{isCollapsed && useSidebarLayout && (
							<TooltipProvider delayDuration={0}>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											onClick={toggleCollapsed}
											className="flex w-full items-center justify-center rounded-md hover:bg-muted/60 transition-colors py-1"
											aria-label="Expand sidebar"
										>
											<Logo withLabel={false} />
										</button>
									</TooltipTrigger>
									<TooltipContent side="right">
										Expand
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</div>

					{/* Organization selector */}
					{authConfig.organizations.enable &&
						!authConfig.organizations.hideOrganization && (
							<div
								className={cn({
									"md:mt-3": useSidebarLayout && !isCollapsed,
									"md:mt-2": useSidebarLayout && isCollapsed,
								})}
							>
								<OrganzationSelect
									collapsed={isCollapsed && useSidebarLayout}
								/>
							</div>
						)}

					{/* Mobile: user menu on the right */}
					<div
						className={cn(
							"mr-0 ml-auto flex items-center justify-end gap-4",
							{
								"md:hidden": useSidebarLayout,
							},
						)}
					>
						<UserMenu />
					</div>
				</div>

				{/* ── CTA 区域（预留） ── */}

				{/* ── 导航菜单 ── */}
				<TooltipProvider delayDuration={0}>
					<ul
						className={cn(
							"no-scrollbar mt-4 flex list-none items-center justify-start gap-2 overflow-x-auto text-sm",
							{
								"md:mx-0 md:mt-4 md:mb-0 md:flex md:flex-col md:items-stretch md:gap-0.5 md:px-0":
									useSidebarLayout,
								"md:items-center":
									useSidebarLayout && isCollapsed,
							},
						)}
					>
						{menuGroups.map((group, gi) => (
							<React.Fragment key={`group-${gi}`}>
								{/* Group label — only in expanded sidebar */}
								{group.groupLabel &&
									!isCollapsed &&
									useSidebarLayout && (
										<li className="mt-4 mb-1 px-3">
											<span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
												{group.groupLabel}
											</span>
										</li>
									)}
								{/* Separator in collapsed sidebar between groups */}
								{group.groupLabel &&
									isCollapsed &&
									useSidebarLayout &&
									gi > 0 && (
										<li className="my-1.5 mx-auto w-5 border-t border-border/40" />
									)}
								{group.items.map((menuItem) => {
									const itemKey =
										menuItem.href ?? menuItem.label;
									const itemClass = cn(
										"flex items-center border border-transparent transition-colors",
										menuItem.isActive
											? "font-semibold bg-primary/8 border-primary/20 text-primary"
											: "hover:bg-muted/50",
									);
									const iconClass = cn(
										"size-4 shrink-0",
										menuItem.isActive
											? "text-primary"
											: "text-muted-foreground opacity-60",
									);

									if (isCollapsed && useSidebarLayout) {
										const collapsedItem =
											menuItem.onClick ? (
												<button
													type="button"
													onClick={menuItem.onClick}
													className={cn(
														itemClass,
														"size-9 justify-center rounded-lg",
													)}
												>
													<menuItem.icon
														className={iconClass}
													/>
												</button>
											) : (
												<Link
													href={menuItem.href ?? "#"}
													className={cn(
														itemClass,
														"size-9 justify-center rounded-lg",
													)}
													prefetch
												>
													<menuItem.icon
														className={iconClass}
													/>
												</Link>
											);
										return (
											<li
												key={itemKey}
												className="flex justify-center"
											>
												<Tooltip>
													<TooltipTrigger asChild>
														{collapsedItem}
													</TooltipTrigger>
													<TooltipContent side="right">
														{menuItem.label}
													</TooltipContent>
												</Tooltip>
											</li>
										);
									}

									const expandedItem = menuItem.onClick ? (
										<button
											type="button"
											onClick={menuItem.onClick}
											className={cn(
												itemClass,
												"group w-full whitespace-nowrap rounded-lg px-3 py-2",
											)}
										>
											<span className="flex items-center gap-3 transition-transform duration-150 ease-out group-hover:translate-x-1">
												<menuItem.icon
													className={iconClass}
												/>
												<span
													className={cn(
														menuItem.isActive
															? "text-primary"
															: "text-muted-foreground",
													)}
												>
													{menuItem.label}
												</span>
											</span>
										</button>
									) : (
										<Link
											href={menuItem.href ?? "#"}
											className={cn(
												itemClass,
												"group w-full whitespace-nowrap rounded-lg px-3 py-2",
											)}
											prefetch
										>
											<span className="flex items-center gap-3 transition-transform duration-150 ease-out group-hover:translate-x-1">
												<menuItem.icon
													className={iconClass}
												/>
												<span
													className={cn(
														menuItem.isActive
															? "text-primary"
															: "text-muted-foreground",
													)}
												>
													{menuItem.label}
												</span>
											</span>
										</Link>
									);

									return (
										<li key={itemKey}>{expandedItem}</li>
									);
								})}
							</React.Fragment>
						))}
					</ul>
				</TooltipProvider>

				{/* ── 底部：用户信息 ── */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: decorative spotlight effect only */}
				<div
					ref={bottomRef}
					role="presentation"
					className={cn(
						"relative mt-auto mb-0 hidden flex-col overflow-hidden pb-4 pt-2 border-t border-border/50",
						{
							"md:flex": useSidebarLayout,
						},
					)}
					onMouseMove={handleBottomMouseMove}
					onMouseLeave={() =>
						setSpotlight((s) => ({ ...s, visible: false }))
					}
				>
					{spotlight.visible && (
						<div
							className="pointer-events-none absolute inset-0 transition-opacity duration-300"
							style={{
								background: `radial-gradient(circle 100px at ${spotlight.x}px ${spotlight.y}px, hsl(var(--primary) / 0.12), transparent)`,
							}}
						/>
					)}
					{isCollapsed && useSidebarLayout ? (
						<TooltipProvider delayDuration={0}>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="flex w-full justify-center py-1">
										<UserMenu showUserName={false} />
									</div>
								</TooltipTrigger>
								<TooltipContent side="right">
									Account
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					) : (
						<UserMenu showUserName={true} />
					)}
				</div>
			</div>
		</nav>
	);
}
