"use client";

import { cn, Spinner } from "@repo/ui";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircleIcon,
	CheckIcon,
	ClockIcon,
	EyeIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function WorkflowBoard() {
	const t = useTranslations("flowmail");
	const { activeOrganization } = useActiveOrganization();
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const orgId = activeOrganization?.id ?? "";

	const { data: pendingApprovals, isLoading: loadingApprovals } = useQuery(
		orpc.approvals.listPending.queryOptions({
			input: { organizationId: orgId },
		}),
	);

	const { data: blockedData, isLoading: loadingBlocked } = useQuery(
		orpc.flowEntities.list.queryOptions({
			input: {
				organizationId: orgId,
				status: "blocked",
				limit: 20,
				offset: 0,
			},
		}),
	);

	const { data: reviewData, isLoading: loadingReview } = useQuery(
		orpc.flowEntities.list.queryOptions({
			input: { organizationId: orgId, limit: 100, offset: 0 },
		}),
	);

	const approveMutation = useMutation(
		orpc.approvals.approve.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.approvals.listPending.key(),
				});
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.list.key(),
				});
			},
		}),
	);

	const rejectMutation = useMutation(
		orpc.approvals.reject.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.approvals.listPending.key(),
				});
				queryClient.invalidateQueries({
					queryKey: orpc.flowEntities.list.key(),
				});
			},
		}),
	);

	const blocked = blockedData?.entities ?? [];
	const needsReview = (reviewData?.entities ?? []).filter(
		(e) => e.requiresReview,
	);
	const basePath = pathname.replace(/\/workflows$/, "");

	const lanes = [
		{
			title: t("workflow.column.pendingApproval"),
			icon: ClockIcon,
			color: "text-amber-600",
			items: pendingApprovals ?? [],
			loading: loadingApprovals,
			type: "approval" as const,
		},
		{
			title: t("workflow.column.blocked"),
			icon: AlertCircleIcon,
			color: "text-red-500",
			items: blocked,
			loading: loadingBlocked,
			type: "blocked" as const,
		},
		{
			title: t("workflow.column.needsReview"),
			icon: EyeIcon,
			color: "text-blue-500",
			items: needsReview,
			loading: loadingReview,
			type: "review" as const,
		},
	];

	return (
		<div
			data-module="workflow"
			className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6"
		>
			{lanes.map((lane) => (
				<div key={lane.type}>
					<div className="flex items-center gap-2 mb-3">
						<lane.icon className={cn("size-4", lane.color)} />
						<h3 className="text-sm font-semibold">{lane.title}</h3>
						<Badge
							status="info"
							className="text-[10px] px-1.5 py-0 ml-auto"
						>
							{lane.items.length}
						</Badge>
					</div>

					<div className="space-y-2">
						{lane.loading ? (
							<div className="flex items-center justify-center py-8">
								<Spinner className="size-4 text-primary" />
							</div>
						) : lane.items.length === 0 ? (
							<Card className="p-4 text-center text-sm text-muted-foreground">
								{t("workflow.column.empty")}
							</Card>
						) : (
							lane.items.map((item) => {
								const fields: Record<string, unknown> =
									item.extractedFields
										? JSON.parse(
												item.extractedFields as string,
											)
										: {};

								return (
									<Card key={item.id} className="p-3">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<Link
													href={`${basePath}/inbox?entityId=${item.id}`}
													className="text-sm font-medium hover:underline line-clamp-1"
												>
													{item.title}
												</Link>
												{item.aiSummary && (
													<p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
														{item.aiSummary}
													</p>
												)}
												{fields.amount != null && (
													<p className="text-xs font-medium mt-1">
														{String(
															fields.currency ??
																"",
														)}
														{String(fields.amount)}
													</p>
												)}
											</div>
											<Badge
												status="info"
												className="text-[9px] px-1 py-0 shrink-0"
											>
												{item.type}
											</Badge>
										</div>

										{lane.type === "approval" && (
											<div className="flex gap-1.5 mt-2">
												<Button
													size="sm"
													className="h-6 text-[11px] px-2"
													disabled={
														approveMutation.isPending
													}
													onClick={() =>
														approveMutation.mutate({
															entityId: item.id,
														})
													}
												>
													<CheckIcon className="size-3 mr-0.5" />
													{t(
														"workflow.action.approve",
													)}
												</Button>
												<Button
													size="sm"
													variant="destructive"
													className="h-6 text-[11px] px-2"
													disabled={
														rejectMutation.isPending
													}
													onClick={() =>
														rejectMutation.mutate({
															entityId: item.id,
															reason: "Rejected via Workflows",
														})
													}
												>
													<XIcon className="size-3 mr-0.5" />
													{t(
														"workflow.action.reject",
													)}
												</Button>
											</div>
										)}
									</Card>
								);
							})
						)}
					</div>
				</div>
			))}
		</div>
	);
}
