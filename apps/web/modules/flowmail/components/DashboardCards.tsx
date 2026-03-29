"use client";

import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	FileTextIcon,
	InboxIcon,
	MailIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function StatCard({
	title,
	value,
	icon: Icon,
	href,
}: {
	title: string;
	value: string | number;
	icon: typeof InboxIcon;
	href: string;
}) {
	return (
		<Link href={href} className="block">
			<div className="rounded-xl border bg-card p-6 transition-colors hover:bg-accent/50">
				<div className="flex items-center justify-between">
					<p className="text-sm font-medium text-muted-foreground">{title}</p>
					<Icon className="size-4 text-muted-foreground" />
				</div>
				<p className="mt-2 text-3xl font-bold">{value}</p>
			</div>
		</Link>
	);
}

export function DashboardCards() {
	const { activeOrganization } = useActiveOrganization();
	const pathname = usePathname();

	const { data: allEntities } = useQuery(
		orpc.flowEntities.list.queryOptions({
			input: {
				organizationId: activeOrganization?.id ?? "",
				limit: 1,
				offset: 0,
			},
		}),
	);

	const { data: pendingApprovals } = useQuery(
		orpc.approvals.listPending.queryOptions({
			input: {
				organizationId: activeOrganization?.id ?? "",
			},
		}),
	);

	const { data: reports } = useQuery(
		orpc.flowEntities.list.queryOptions({
			input: {
				organizationId: activeOrganization?.id ?? "",
				type: "REPORT",
				limit: 1,
				offset: 0,
			},
		}),
	);

	const { data: connections } = useQuery(
		orpc.emailConnections.list.queryOptions({
			input: {
				organizationId: activeOrganization?.id ?? "",
			},
		}),
	);

	return (
		<>
			<div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
				<StatCard
					title="Total Items"
					value={allEntities?.total ?? 0}
					icon={InboxIcon}
					href={`${pathname}/inbox`}
				/>
				<StatCard
					title="Pending Approvals"
					value={pendingApprovals?.length ?? 0}
					icon={CheckCircle2Icon}
					href={`${pathname}/approvals`}
				/>
				<StatCard
					title="Active Reports"
					value={reports?.total ?? 0}
					icon={FileTextIcon}
					href={`${pathname}/reports`}
				/>
				<StatCard
					title="Connected Emails"
					value={connections?.length ?? 0}
					icon={MailIcon}
					href={`${pathname}/settings/email-connections`}
				/>
			</div>
			<div className="mt-8 rounded-xl border bg-card p-8 text-center">
				<p className="text-muted-foreground">
					Connect your email to get started. Flowmail will automatically extract approvals and reports from your inbox.
				</p>
			</div>
		</>
	);
}
