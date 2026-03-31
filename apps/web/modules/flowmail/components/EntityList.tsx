"use client";

import { Badge } from "@repo/ui/components/badge";
import { Card } from "@repo/ui/components/card";
import { Spinner } from "@repo/ui";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	ClockIcon,
	AlertCircleIcon,
	XCircleIcon,
	InboxIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const statusConfig: Record<string, { badgeStatus: "success" | "info" | "warning" | "error"; icon: typeof ClockIcon }> = {
	pending: { badgeStatus: "warning", icon: ClockIcon },
	approved: { badgeStatus: "success", icon: CheckCircle2Icon },
	rejected: { badgeStatus: "error", icon: XCircleIcon },
	in_progress: { badgeStatus: "info", icon: ClockIcon },
	completed: { badgeStatus: "success", icon: CheckCircle2Icon },
	blocked: { badgeStatus: "error", icon: AlertCircleIcon },
	open: { badgeStatus: "warning", icon: AlertCircleIcon },
	received: { badgeStatus: "info", icon: InboxIcon },
};

function StatusBadge({ status }: { status: string }) {
	const config = statusConfig[status] ?? statusConfig.pending;
	const Icon = config.icon;
	return (
		<Badge status={config.badgeStatus} className="gap-1 inline-flex items-center">
			<Icon className="size-3" />
			{status}
		</Badge>
	);
}

function UrgencyDot({ urgency }: { urgency?: string }) {
	if (!urgency || urgency === "normal" || urgency === "low") {
		return null;
	}
	const color = urgency === "urgent" ? "bg-red-500" : "bg-orange-400";
	return <span className={`inline-block size-2 rounded-full ${color}`} title={urgency} />;
}

export function EntityList({
	type,
	title,
	emptyMessage,
}: {
	type?: "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK";
	title: string;
	emptyMessage: string;
}) {
	const { activeOrganization } = useActiveOrganization();
	const pathname = usePathname();

	const { data, isLoading } = useQuery({
		...orpc.flowEntities.list.queryOptions({
			input: {
				organizationId: activeOrganization?.id ?? "",
				type,
				limit: 50,
				offset: 0,
			},
		}),
		refetchInterval: 5000,
	});

	const entities = data?.entities ?? [];

	return (
		<Card className="p-0">
			<div className="rounded-md">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[50%]">{title}</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Assignee</TableHead>
							<TableHead className="text-right">Updated</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={4} className="h-32 text-center">
									<div className="flex items-center justify-center gap-2">
										<Spinner className="size-4 text-primary" />
										Loading...
									</div>
								</TableCell>
							</TableRow>
						) : entities.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
									{emptyMessage}
								</TableCell>
							</TableRow>
						) : (
							entities.map((entity) => {
								const fields = entity.extractedFields
									? JSON.parse(entity.extractedFields as string)
									: {};

								return (
									<TableRow key={entity.id} className="group cursor-pointer">
										<TableCell>
											<Link
												href={`${pathname}/${entity.id}`}
												className="flex items-center gap-2"
											>
												<UrgencyDot urgency={fields.urgency} />
												<div>
													<p className="font-medium group-hover:underline">
														{entity.title}
													</p>
													{entity.aiSummary && (
														<p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
															{entity.aiSummary}
														</p>
													)}
												</div>
											</Link>
										</TableCell>
										<TableCell>
											<StatusBadge status={entity.status} />
										</TableCell>
										<TableCell>
											{entity.assignee ? (
												<span className="text-sm">{entity.assignee.name ?? entity.assignee.email}</span>
											) : (
												<span className="text-sm text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="text-right text-sm text-muted-foreground">
											{new Date(entity.updatedAt).toLocaleDateString()}
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>
		</Card>
	);
}
