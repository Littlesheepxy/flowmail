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
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	BrainIcon,
	FileTextIcon,
	InboxIcon,
	MailIcon,
	MessageSquareIcon,
	PanelLeftCloseIcon,
	PlugIcon,
	PlusIcon,
	SettingsIcon,
	ShieldCheckIcon,
	TagIcon,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { config as webConfig } from "@/config";
import { OrganzationSelect } from "../../organizations/components/OrganizationSelect";
import { OrgSettingsModal, type OrgTab } from "./OrgSettingsModal";
import { NotificationBell } from "@/modules/flowmail/components/NotificationCenter";
import { ProductTour } from "@/modules/flowmail/components/ProductTour";
import { SetupGuide } from "@/modules/flowmail/components/SetupGuide";
import { useSidebar } from "../lib/sidebar-context";

const ICON_MAP: Record<string, LucideIcon> = {
	ShieldCheckIcon,
	FileTextIcon,
	AlertTriangleIcon,
	MessageSquareIcon,
	InboxIcon,
	MailIcon,
	TagIcon,
	SettingsIcon,
};

function resolveIcon(iconName: string): LucideIcon {
	return ICON_MAP[iconName] ?? TagIcon;
}

export function NavBar() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { activeOrganization } = useActiveOrganization();
	const router = useRouter();
	const { isCollapsed, toggleCollapsed } = useSidebar();
	const [orgModalOpen, setOrgModalOpen] = useState(false);
	const [orgModalTab, setOrgModalTab] = useState<OrgTab>("general");

	useEffect(() => {
		function handleOpenSettings(e: Event) {
			const detail = (e as CustomEvent).detail as { tab?: string } | undefined;
			if (detail?.tab === "ai-memory" && activeOrganization?.slug) {
				router.push(`/app/${activeOrganization.slug}/ai-memory`);
				return;
			}
			if (detail?.tab === "agent" && activeOrganization?.slug) {
				router.push(`/app/${activeOrganization.slug}/agent`);
				return;
			}
			if (detail?.tab) {
				setOrgModalTab(detail.tab as OrgTab);
			}
			setOrgModalOpen(true);
		}
		window.addEventListener("flowmail:open-settings", handleOpenSettings);
		return () => window.removeEventListener("flowmail:open-settings", handleOpenSettings);
	}, [activeOrganization?.slug, router]);

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

	const { data: categories } = useQuery({
		...orpc.categories.list.queryOptions({
			input: { organizationId: activeOrganization?.id ?? "" },
		}),
		enabled: !!activeOrganization?.id,
	});

	type MenuItem = {
		label: string;
		icon: React.ElementType;
		isActive: boolean;
		href?: string;
		onClick?: () => void;
		badge?: number;
		color?: string;
		dataTour?: string;
		indent?: boolean;
	};

	type MenuGroup = {
		groupLabel?: string;
		items: MenuItem[];
	};

	const categoryMenuItems: MenuItem[] = useMemo(() => {
		if (!categories) {
			return [];
		}
		return categories.map((cat) => ({
			label: cat.name,
			icon: resolveIcon(cat.icon),
			href: `${basePath}/inbox?category=${cat.slug}`,
			isActive:
				pathname.startsWith(`${basePath}/inbox`) &&
				searchParams.get("category") === cat.slug,
			badge: cat._count.entities,
			color: cat.color,
		}));
	}, [categories, basePath, pathname, searchParams]);

	const menuGroups: MenuGroup[] = [
		...(activeOrganization
			? [
					{
						items: [
							{
								label: "收件箱",
								href: `${basePath}/inbox`,
								icon: InboxIcon,
								dataTour: "inbox",
								isActive:
								pathname.startsWith(`${basePath}/inbox`) &&
								!searchParams.has("category"),
							},
							...categoryMenuItems.map((item) => ({
								...item,
								indent: true as const,
							})),
						],
					},
					{
						groupLabel: "管理",
						items: [
							{
								label: "邮箱连接",
								href: `${basePath}/connections`,
								icon: MailIcon,
								dataTour: "connections",
								isActive: pathname.startsWith(
									`${basePath}/connections`,
								),
							},
							{
								label: "分类管理",
								href: `${basePath}/categories`,
								icon: SettingsIcon,
								dataTour: "categories",
								isActive: pathname.startsWith(
									`${basePath}/categories`,
								),
							},
						],
					},
					{
						groupLabel: "Agent",
						items: [
							{
								label: "AI 记忆",
								icon: BrainIcon,
								href: `${basePath}/ai-memory`,
								isActive: pathname.startsWith(`${basePath}/ai-memory`),
							},
							{
								label: "Agent 接入",
								icon: PlugIcon,
								href: `${basePath}/agent`,
								isActive: pathname.startsWith(`${basePath}/agent`),
							},
						],
					},
				]
			: []),
	];

	return (
		<>
		<nav
			data-module="navigation"
			className={cn("w-full", {
				"w-full md:fixed md:top-0 md:left-0 md:h-full md:z-20 md:transition-[width] md:duration-300 md:ease-in-out md:w-[260px]":
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
						"md:h-[56px]": useSidebarLayout,
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
										<li className="mt-4 mb-1 px-3 flex items-center justify-between">
											<span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
												{group.groupLabel}
											</span>
											{group.groupLabel === "分类" && (
												<Link
													href={`${basePath}/categories`}
													className="flex size-4 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
													prefetch
												>
													<PlusIcon className="size-3" />
												</Link>
											)}
										</li>
									)}
								{/* Separator + add button in collapsed sidebar between groups */}
								{group.groupLabel &&
									isCollapsed &&
									useSidebarLayout &&
									gi > 0 && (
										<li className="my-1.5 flex justify-center">
											{group.groupLabel === "分类" ? (
												<Tooltip>
													<TooltipTrigger asChild>
														<Link
															href={`${basePath}/categories`}
															className="flex size-5 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
															prefetch
														>
															<PlusIcon className="size-3" />
														</Link>
													</TooltipTrigger>
													<TooltipContent side="right">
														新建分类
													</TooltipContent>
												</Tooltip>
											) : (
												<div className="w-5" />
											)}
										</li>
									)}
								{group.items.map((menuItem) => {
									const itemKey =
										menuItem.href ?? menuItem.label;
									const itemClass = cn(
										"flex items-center transition-colors",
										menuItem.isActive
											? "font-semibold bg-primary/8 text-primary"
											: "hover:bg-muted/50",
										menuItem.indent && "ml-3",
									);
									const iconStyle = menuItem.color
										? { color: menuItem.color }
										: undefined;
									const iconClass = cn(
										"shrink-0",
										menuItem.indent ? "size-3.5" : "size-4",
										!menuItem.color &&
											(menuItem.isActive
												? "text-primary"
												: "text-muted-foreground opacity-60"),
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
														style={iconStyle}
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
														style={iconStyle}
													/>
												</Link>
											);
										return (
											<li
												key={itemKey}
												className="flex justify-center"
												data-tour={menuItem.dataTour}
											>
												<Tooltip>
													<TooltipTrigger asChild>
														{collapsedItem}
													</TooltipTrigger>
													<TooltipContent side="right">
														{menuItem.label}
														{menuItem.badge != null &&
															menuItem.badge > 0 && (
																<span className="ml-1.5 text-xs opacity-70">
																	{menuItem.badge}
																</span>
															)}
													</TooltipContent>
												</Tooltip>
											</li>
										);
									}

									const itemContent = (
										<span className="flex w-full items-center gap-3 transition-transform duration-150 ease-out group-hover:translate-x-1">
											<menuItem.icon
												className={iconClass}
												style={iconStyle}
											/>
											<span
												className={cn(
													"flex-1 truncate",
													menuItem.isActive
														? "text-primary"
														: "text-muted-foreground",
												)}
											>
												{menuItem.label}
											</span>
											{menuItem.badge != null &&
												menuItem.badge > 0 && (
													<span className="ml-auto text-[10px] tabular-nums text-muted-foreground/70">
														{menuItem.badge}
													</span>
												)}
										</span>
									);

									const expandedItem = menuItem.onClick ? (
										<button
											type="button"
											onClick={menuItem.onClick}
											className={cn(
												itemClass,
												"group w-full whitespace-nowrap rounded-lg text-left",
												menuItem.indent ? "px-2.5 py-1.5 text-[13px]" : "px-3 py-2",
											)}
										>
											{itemContent}
										</button>
									) : (
										<Link
											href={menuItem.href ?? "#"}
											className={cn(
												itemClass,
												"group w-full whitespace-nowrap rounded-lg",
												menuItem.indent ? "px-2.5 py-1.5 text-[13px]" : "px-3 py-2",
											)}
											prefetch
										>
											{itemContent}
										</Link>
									);

									return (
										<li key={itemKey} data-tour={menuItem.dataTour}>{expandedItem}</li>
									);
								})}

								{/* Dashed "add category" button after category items */}
								{group.groupLabel === "分类" &&
									!isCollapsed &&
									useSidebarLayout && (
										<li className="px-2 mt-1">
											<Link
												href={`${basePath}/categories`}
												className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed border-border/60 px-3 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
												prefetch
											>
												<PlusIcon className="size-3" />
												添加分类
											</Link>
										</li>
									)}
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
						"relative mt-auto mb-0 hidden flex-col overflow-hidden pb-4 pt-2",
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
					<SetupGuide
						collapsed={isCollapsed && useSidebarLayout}
						basePath={basePath}
					/>
					{activeOrganization && (
						<div
							className={cn("flex items-center", isCollapsed && useSidebarLayout ? "justify-center mb-2" : "px-3 mb-2")}
							data-tour="notifications"
						>
							<NotificationBell
								organizationId={activeOrganization.id}
								basePath={basePath}
								collapsed={isCollapsed && useSidebarLayout}
							/>
						</div>
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

		{activeOrganization && (
			<OrgSettingsModal
				open={orgModalOpen}
				onOpenChange={setOrgModalOpen}
				defaultTab={orgModalTab}
			/>
		)}
		{activeOrganization && <ProductTour />}
		</>
	);
}
