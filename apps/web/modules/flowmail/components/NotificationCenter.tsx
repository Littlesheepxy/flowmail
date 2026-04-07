"use client";

import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	ArrowRightIcon,
	BellIcon,
	CheckCheckIcon,
	ClockIcon,
	InboxIcon,
	MailIcon,
	ShieldCheckIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";

const NOTIFICATION_TYPE_STYLE: Record<
	string,
	{ icon: typeof BellIcon; color: string }
> = {
	DEADLINE_WARNING: {
		icon: ClockIcon,
		color: "text-yellow-500",
	},
	DEADLINE_OVERDUE: {
		icon: AlertTriangleIcon,
		color: "text-red-500",
	},
	APPROVAL_TIMEOUT: {
		icon: ShieldCheckIcon,
		color: "text-orange-500",
	},
	NEW_ENTITY: {
		icon: SparklesIcon,
		color: "text-blue-500",
	},
	STATUS_CHANGED: {
		icon: ArrowRightIcon,
		color: "text-teal-500",
	},
	DAILY_DIGEST: {
		icon: MailIcon,
		color: "text-muted-foreground",
	},
};

interface NotificationBellProps {
	organizationId: string;
	basePath: string;
	collapsed?: boolean;
}

export function NotificationBell({
	organizationId,
	basePath,
	collapsed,
}: NotificationBellProps) {
	const t = useTranslations("flowmail");
	const locale = useLocale();
	const queryClient = useQueryClient();

	const { data: unreadData } = useQuery({
		...orpc.notifications.getUnreadCount.queryOptions({
			input: { organizationId },
		}),
		refetchInterval: 30000,
	});

	const { data: notifications } = useQuery({
		...orpc.notifications.list.queryOptions({
			input: { organizationId, limit: 10 },
		}),
		refetchInterval: 30000,
	});

	const markReadMutation = useMutation(
		orpc.notifications.markRead.mutationOptions(),
	);

	const unreadCount = unreadData?.count ?? 0;

	const handleMarkAllRead = useCallback(async () => {
		await markReadMutation.mutateAsync({
			organizationId,
			markAll: true,
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.notifications.getUnreadCount.queryOptions({
				input: { organizationId },
			}).queryKey,
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.notifications.list.queryOptions({
				input: { organizationId, limit: 10 },
			}).queryKey,
		});
	}, [organizationId, markReadMutation, queryClient]);

	const handleMarkSingleRead = useCallback(
		async (notificationId: string) => {
			await markReadMutation.mutateAsync({
				organizationId,
				notificationId,
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.notifications.getUnreadCount.queryOptions({
					input: { organizationId },
				}).queryKey,
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.notifications.list.queryOptions({
					input: { organizationId, limit: 10 },
				}).queryKey,
			});
		},
		[organizationId, markReadMutation, queryClient],
	);

	const items = notifications?.items ?? [];

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"relative flex items-center justify-center rounded-lg transition-colors hover:bg-muted/60",
						collapsed ? "size-9" : "size-8",
					)}
					aria-label={
						unreadCount > 0
							? t("notification.aria.bellWithUnread", {
									count: unreadCount,
								})
							: t("notification.aria.bell")
					}
				>
					<BellIcon className="size-4 text-muted-foreground" />
					{unreadCount > 0 && (
						<span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
							{unreadCount > 9 ? "9+" : unreadCount}
						</span>
					)}
				</button>
			</PopoverTrigger>

			<PopoverContent
				side="right"
				align="end"
				className="w-[360px] p-0"
				sideOffset={8}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b px-4 py-3">
					<h3 className="text-sm font-semibold">
						{t("notification.panel.title")}
					</h3>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 gap-1.5 text-xs text-muted-foreground"
							onClick={handleMarkAllRead}
							disabled={markReadMutation.isPending}
						>
							<CheckCheckIcon className="size-3" />
							{t("notification.action.markAllRead")}
						</Button>
					)}
				</div>

				{/* List */}
				<div className="max-h-[400px] overflow-y-auto">
					{items.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
							<InboxIcon className="size-8 mb-2 stroke-1" />
							<p className="text-xs">{t("notification.empty")}</p>
						</div>
					) : (
						<div className="divide-y">
							{items.map((notification) => {
								const cfg = NOTIFICATION_TYPE_STYLE[
									notification.type
								] ?? {
									icon: BellIcon,
									color: "text-muted-foreground",
								};
								const Icon = cfg.icon;

								return (
									<div
										key={notification.id}
										className={cn(
											"flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30",
											!notification.isRead &&
												"bg-primary/3",
										)}
									>
										<div
											className={cn(
												"mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
												notification.isRead
													? "bg-muted/50"
													: "bg-primary/10",
											)}
										>
											<Icon
												className={cn(
													"size-3.5",
													notification.isRead
														? "text-muted-foreground"
														: cfg.color,
												)}
											/>
										</div>

										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span
													className={cn(
														"text-xs font-medium truncate",
														!notification.isRead &&
															"text-foreground",
														notification.isRead &&
															"text-muted-foreground",
													)}
												>
													{notification.title}
												</span>
												{!notification.isRead && (
													<span className="size-1.5 rounded-full bg-primary shrink-0" />
												)}
											</div>
											<p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
												{notification.body}
											</p>
											<div className="flex items-center gap-2 mt-1">
												<span className="text-[10px] text-muted-foreground/60">
													{formatRelativeTime(
														notification.createdAt,
														t,
														locale,
													)}
												</span>
												{notification.entityId && (
													<Link
														href={`${basePath}/inbox/${notification.entityId}`}
														className="text-[10px] text-primary hover:underline"
														onClick={() => {
															if (
																!notification.isRead
															) {
																handleMarkSingleRead(
																	notification.id,
																);
															}
														}}
													>
														{t(
															"notification.action.view",
														)}
													</Link>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function formatRelativeTime(
	dateStr: string,
	t: (key: string, values?: { count: number }) => string,
	locale: string,
): string {
	const d = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);

	if (diffMins < 1) {
		return t("time.justNow");
	}
	if (diffMins < 60) {
		return t("time.minutesAgo", { count: diffMins });
	}
	const diffHours = Math.floor(diffMs / 3600000);
	if (diffHours < 24) {
		return t("time.hoursAgo", { count: diffHours });
	}
	const diffDays = Math.floor(diffMs / 86400000);
	if (diffDays < 7) {
		return t("time.daysAgo", { count: diffDays });
	}
	return d.toLocaleDateString(locale);
}
