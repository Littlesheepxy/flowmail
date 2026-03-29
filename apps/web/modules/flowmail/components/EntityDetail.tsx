"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Spinner } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeftIcon,
	CheckCircle2Icon,
	ClockIcon,
	AlertCircleIcon,
	XCircleIcon,
	InboxIcon,
	MailIcon,
	BotIcon,
	UserIcon,
	CheckIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const statusConfig: Record<
	string,
	{ badgeStatus: "success" | "info" | "warning" | "error"; icon: typeof ClockIcon }
> = {
	pending: { badgeStatus: "warning", icon: ClockIcon },
	approved: { badgeStatus: "success", icon: CheckCircle2Icon },
	rejected: { badgeStatus: "error", icon: XCircleIcon },
	in_progress: { badgeStatus: "info", icon: ClockIcon },
	completed: { badgeStatus: "success", icon: CheckCircle2Icon },
	blocked: { badgeStatus: "error", icon: AlertCircleIcon },
	open: { badgeStatus: "warning", icon: AlertCircleIcon },
	received: { badgeStatus: "info", icon: InboxIcon },
};

const timelineIcons: Record<string, typeof MailIcon> = {
	email_received: MailIcon,
	status_changed: AlertCircleIcon,
	action_taken: CheckCircle2Icon,
	ai_summary: BotIcon,
};

function FieldGrid({ fields }: { fields: Record<string, unknown> }) {
	const entries = Object.entries(fields).filter(
		([_, v]) => v !== null && v !== undefined && v !== "",
	);
	if (entries.length === 0) {
		return null;
	}

	return (
		<div className="grid grid-cols-2 gap-3 text-sm">
			{entries.map(([key, value]) => (
				<div key={key} className="space-y-0.5">
					<dt className="text-muted-foreground capitalize">
						{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
					</dt>
					<dd className="font-medium">{String(value)}</dd>
				</div>
			))}
		</div>
	);
}

export function EntityDetail() {
	const params = useParams();
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const entityId = params.entityId as string;

	const backPath = pathname.split("/").slice(0, -1).join("/");

	const { data: entity, isLoading } = useQuery(
		orpc.flowEntities.get.queryOptions({
			input: { entityId },
		}),
	);

	const approveMutation = useMutation(
		orpc.approvals.approve.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({ input: { entityId } }),
				});
			},
		}),
	);

	const rejectMutation = useMutation(
		orpc.approvals.reject.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({ input: { entityId } }),
				});
			},
		}),
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Spinner className="size-6 text-primary" />
			</div>
		);
	}

	if (!entity) {
		return (
			<div className="py-20 text-center text-muted-foreground">
				Entity not found
			</div>
		);
	}

	const fields: Record<string, unknown> = entity.extractedFields
		? JSON.parse(entity.extractedFields as string)
		: {};

	const statusCfg = statusConfig[entity.status] ?? statusConfig.pending;
	const StatusIcon = statusCfg.icon;
	const isApproval = entity.type === "APPROVAL";
	const isPending = entity.status === "pending";
	const actionPending = approveMutation.isPending || rejectMutation.isPending;

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<Link href={backPath}>
					<Button variant="ghost" size="icon">
						<ArrowLeftIcon className="size-4" />
					</Button>
				</Link>
				<div className="flex-1">
					<h2 className="text-xl font-semibold">{entity.title}</h2>
					<div className="mt-1 flex items-center gap-2">
						<Badge status={statusCfg.badgeStatus} className="gap-1">
							<StatusIcon className="size-3" />
							{entity.status}
						</Badge>
						<Badge status="info">{entity.type}</Badge>
						{entity.aiConfidence != null && (
							<span className="text-xs text-muted-foreground">
								{Math.round(entity.aiConfidence * 100)}% confidence
							</span>
						)}
					</div>
				</div>

				{isApproval && isPending && (
					<div className="flex gap-2">
						<Button
							disabled={actionPending}
							onClick={() => approveMutation.mutate({ entityId })}
						>
							<CheckIcon className="mr-1 size-4" />
							批准
						</Button>
						<Button
							variant="destructive"
							disabled={actionPending}
							onClick={() =>
								rejectMutation.mutate({
									entityId,
									reason: "Rejected via detail page",
								})
							}
						>
							<XIcon className="mr-1 size-4" />
							拒绝
						</Button>
					</div>
				)}
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main content */}
				<div className="space-y-6 lg:col-span-2">
					{entity.aiSummary && (
						<Card className="p-4">
							<div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<BotIcon className="size-4" />
								AI 摘要
							</div>
							<p className="text-sm leading-relaxed">{entity.aiSummary}</p>
						</Card>
					)}

					{Object.keys(fields).length > 0 && (
						<Card className="p-4">
							<h3 className="mb-3 text-sm font-medium text-muted-foreground">
								提取字段
							</h3>
							<FieldGrid fields={fields} />
						</Card>
					)}

					{/* Email threads */}
					{entity.threads && entity.threads.length > 0 && (
						<Card className="p-4">
							<h3 className="mb-3 text-sm font-medium text-muted-foreground">
								关联邮件
							</h3>
							<div className="space-y-3">
								{entity.threads.map((thread) => (
									<div
										key={thread.id}
										className="flex items-start gap-3 rounded-md border p-3"
									>
										<MailIcon className="mt-0.5 size-4 text-muted-foreground" />
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium">{thread.subject}</p>
											<p className="text-xs text-muted-foreground">
												From: {thread.sender} &middot;{" "}
												{new Date(thread.receivedAt).toLocaleString()}
											</p>
											{thread.snippet && (
												<p className="mt-1 text-xs text-muted-foreground line-clamp-2">
													{thread.snippet}
												</p>
											)}
										</div>
									</div>
								))}
							</div>
						</Card>
					)}
				</div>

				{/* Timeline sidebar */}
				<div>
					<Card className="p-4">
						<h3 className="mb-4 text-sm font-medium text-muted-foreground">
							时间线
						</h3>
						<div className="space-y-4">
							{entity.timeline?.map((event) => {
								const Icon = timelineIcons[event.type] ?? ClockIcon;
								return (
									<div key={event.id} className="flex gap-3">
										<div className="flex flex-col items-center">
											<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
												<Icon className="size-3.5 text-muted-foreground" />
											</div>
											<div className="w-px flex-1 bg-border" />
										</div>
										<div className="pb-4">
											<p className="text-sm">{event.content}</p>
											<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
												{event.actor && (
													<span className="flex items-center gap-1">
														<UserIcon className="size-3" />
														{event.actor.name}
													</span>
												)}
												<span>
													{new Date(event.createdAt).toLocaleString()}
												</span>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}
