"use client";

import { Badge } from "@repo/ui/components/badge";
import { Card } from "@repo/ui/components/card";
import { Spinner, cn } from "@repo/ui";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	AlertCircleIcon,
	CheckCircle2Icon,
	ClockIcon,
	FileTextIcon,
	InboxIcon,
	ListTodoIcon,
	MailIcon,
	MessageSquareIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TYPE_CONFIGS: Record<string, { icon: typeof InboxIcon; color: string; bg: string; label: string }> = {
	APPROVAL: { icon: CheckCircle2Icon, color: "text-amber-600", bg: "bg-amber-500/10", label: "审批" },
	REPORT: { icon: FileTextIcon, color: "text-blue-600", bg: "bg-blue-500/10", label: "汇报" },
	ISSUE: { icon: AlertCircleIcon, color: "text-red-600", bg: "bg-red-500/10", label: "问题" },
	FEEDBACK: { icon: MessageSquareIcon, color: "text-emerald-600", bg: "bg-emerald-500/10", label: "反馈" },
};

export function DashboardCards() {
	const { activeOrganization } = useActiveOrganization();
	const pathname = usePathname();
	const orgId = activeOrganization?.id ?? "";

	const { data: allData, isLoading } = useQuery({
		...orpc.flowEntities.list.queryOptions({
			input: { organizationId: orgId, limit: 100, offset: 0 },
		}),
		refetchInterval: 5000,
	});

	const { data: pendingApprovals } = useQuery({
		...orpc.approvals.listPending.queryOptions({ input: { organizationId: orgId } }),
		refetchInterval: 5000,
	});

	const { data: connections } = useQuery(
		orpc.emailConnections.list.queryOptions({ input: { organizationId: orgId } }),
	);

	const entities = allData?.entities ?? [];
	const typeCounts: Record<string, number> = {};
	for (const e of entities) {
		typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
	}

	const blocked = entities.filter((e) => e.status === "blocked");
	const needsReview = entities.filter((e) => e.requiresReview);
	const recentEntities = entities.slice(0, 8);

	return (
		<div className="space-y-8 mt-6">
			{/* Category distribution */}
			<div>
				<h3 className="text-sm font-medium text-muted-foreground mb-3">分类分布</h3>
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
					{(["APPROVAL", "REPORT", "ISSUE", "FEEDBACK"] as const).map((type) => {
						const cfg = TYPE_CONFIGS[type];
						const count = typeCounts[type] ?? 0;
						return (
							<Link key={type} href={`${pathname}/inbox?type=${type}`}>
								<Card className="p-4 hover:border-primary/30 transition-colors cursor-pointer">
									<div className="flex items-center justify-between mb-2">
										<div className={cn("size-8 rounded-lg flex items-center justify-center", cfg.bg)}>
											<cfg.icon className={cn("size-4", cfg.color)} />
										</div>
										<span className="text-2xl font-bold tabular-nums">{count}</span>
									</div>
									<p className="text-sm text-muted-foreground">{cfg.label}</p>
								</Card>
							</Link>
						);
					})}
				</div>
			</div>

			{/* Quick stats row */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
				<Link href={`${pathname}/workflows`}>
					<Card className="p-4 hover:border-primary/30 transition-colors">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<ClockIcon className="size-3.5" />
							<span className="text-xs">待审批</span>
						</div>
						<p className="text-xl font-bold">{pendingApprovals?.length ?? 0}</p>
					</Card>
				</Link>
				<Link href={`${pathname}/workflows`}>
					<Card className="p-4 hover:border-primary/30 transition-colors">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<AlertCircleIcon className="size-3.5" />
							<span className="text-xs">已阻塞</span>
						</div>
						<p className="text-xl font-bold">{blocked.length}</p>
					</Card>
				</Link>
				<Link href={`${pathname}/inbox`}>
					<Card className="p-4 hover:border-primary/30 transition-colors">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<ListTodoIcon className="size-3.5" />
							<span className="text-xs">需复核</span>
						</div>
						<p className="text-xl font-bold">{needsReview.length}</p>
					</Card>
				</Link>
				<Link href={`${pathname}/settings/email-connections`}>
					<Card className="p-4 hover:border-primary/30 transition-colors">
						<div className="flex items-center gap-2 text-muted-foreground mb-1">
							<MailIcon className="size-3.5" />
							<span className="text-xs">已连接邮箱</span>
						</div>
						<p className="text-xl font-bold">{connections?.length ?? 0}</p>
					</Card>
				</Link>
			</div>

			{/* Recent activity */}
			<div>
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-sm font-medium text-muted-foreground">近期动态</h3>
					<Link href={`${pathname}/inbox`} className="text-xs text-primary hover:underline">
						查看全部
					</Link>
				</div>
				{isLoading ? (
					<div className="flex justify-center py-8">
						<Spinner className="size-4 text-primary" />
					</div>
				) : recentEntities.length === 0 ? (
					<Card className="p-8 text-center">
						<InboxIcon className="size-8 text-muted-foreground/30 mx-auto mb-2" />
						<p className="text-sm text-muted-foreground">
							连接邮箱后，Flowmail 将自动分类处理你的邮件。
						</p>
						<Link
							href={`${pathname}/settings/email-connections`}
							className="inline-block mt-3 text-sm text-primary hover:underline"
						>
							连接邮箱
						</Link>
					</Card>
				) : (
					<div className="space-y-1.5">
						{recentEntities.map((entity) => {
							const cfg = TYPE_CONFIGS[entity.type];
							return (
								<Link
									key={entity.id}
									href={`${pathname}/inbox`}
									className="flex items-center gap-3 rounded-lg border px-4 py-2.5 hover:bg-muted/30 transition-colors"
								>
									<div className={cn("size-7 rounded flex items-center justify-center shrink-0", cfg?.bg)}>
										{cfg ? <cfg.icon className={cn("size-3.5", cfg.color)} /> : <InboxIcon className="size-3.5 text-muted-foreground" />}
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate">{entity.title}</p>
										{entity.aiSummary && (
											<p className="text-xs text-muted-foreground truncate">{entity.aiSummary}</p>
										)}
									</div>
									<Badge status={entity.status === "pending" ? "warning" : entity.status === "approved" ? "success" : "info"} className="text-[10px] px-1.5 py-0 shrink-0">
										{entity.status}
									</Badge>
									<span className="text-[10px] text-muted-foreground/60 shrink-0">
										{new Date(entity.updatedAt).toLocaleDateString()}
									</span>
								</Link>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
