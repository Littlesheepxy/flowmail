"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	ClockIcon,
	AlertCircleIcon,
	XCircleIcon,
	InboxIcon,
	PencilIcon,
	CheckIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getStatusLabel } from "../lib/entity-type-config";

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
			{getStatusLabel(status)}
		</Badge>
	);
}

function InlineRenameTitle({
	entityId,
	title,
	href,
	aiSummary,
	urgency,
}: {
	entityId: string;
	title: string;
	href: string;
	aiSummary?: string | null;
	urgency?: string;
}) {
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(title);

	const renameMutation = useMutation(
		orpc.flowEntities.rename.mutationOptions({
			onSuccess: (data) => {
				if (data.changed) {
					toast.success("已重命名");
				}
				setEditing(false);
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.list.key(),
				});
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.get.key({ input: { entityId } }),
				});
			},
			onError: (err) => {
				toast.error(`重命名失败：${err.message}`);
			},
		}),
	);

	function commit() {
		const next = draft.trim();
		if (!next) {
			toast.error("标题不能为空");
			return;
		}
		if (next === title) {
			setEditing(false);
			return;
		}
		renameMutation.mutate({ entityId, title: next });
	}

	if (editing) {
		return (
			<div className="flex items-center gap-1.5">
				<UrgencyDot urgency={urgency} />
				<Input
					value={draft}
					autoFocus
					disabled={renameMutation.isPending}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							commit();
						} else if (e.key === "Escape") {
							setDraft(title);
							setEditing(false);
						}
					}}
					className="h-7 text-sm"
				/>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					className="size-7 shrink-0"
					disabled={renameMutation.isPending}
					onClick={commit}
				>
					<CheckIcon className="size-3.5" />
				</Button>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					className="size-7 shrink-0"
					disabled={renameMutation.isPending}
					onClick={() => {
						setDraft(title);
						setEditing(false);
					}}
				>
					<XIcon className="size-3.5" />
				</Button>
			</div>
		);
	}

	return (
		<Link href={href} className="flex items-center gap-2">
			<UrgencyDot urgency={urgency} />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1">
					<p className="font-medium group-hover:underline truncate">{title}</p>
					<button
						type="button"
						title="重命名"
						aria-label="重命名"
						className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setDraft(title);
							setEditing(true);
						}}
					>
						<PencilIcon className="size-3 text-muted-foreground" />
					</button>
				</div>
				{aiSummary && (
					<p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
						{aiSummary}
					</p>
				)}
			</div>
		</Link>
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
											<InlineRenameTitle
												entityId={entity.id}
												title={entity.title}
												href={`${pathname}/${entity.id}`}
												aiSummary={entity.aiSummary}
												urgency={fields.urgency}
											/>
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
