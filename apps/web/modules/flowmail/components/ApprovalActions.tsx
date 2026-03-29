"use client";

import { Button } from "@repo/ui/components/button";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	CheckIcon,
	XIcon,
	ClockIcon,
} from "lucide-react";

export function PendingApprovalsList() {
	const { activeOrganization } = useActiveOrganization();
	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery(
		orpc.approvals.listPending.queryOptions({
			input: {
				organizationId: activeOrganization?.id ?? "",
			},
		}),
	);

	const approveMutation = useMutation(
		orpc.approvals.approve.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.approvals.listPending.key() });
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.list.key() });
			},
		}),
	);

	const rejectMutation = useMutation(
		orpc.approvals.reject.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.approvals.listPending.key() });
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.list.key() });
			},
		}),
	);

	const approvals = data ?? [];

	return (
		<Card className="p-0">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[40%]">Request</TableHead>
						<TableHead>Requester</TableHead>
						<TableHead>Urgency</TableHead>
						<TableHead className="text-right">Actions</TableHead>
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
					) : approvals.length === 0 ? (
						<TableRow>
							<TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
								<div className="flex flex-col items-center gap-2">
									<ClockIcon className="size-8 text-muted-foreground/50" />
									<p>No pending approvals</p>
									<p className="text-xs">All caught up! New approvals will appear here automatically.</p>
								</div>
							</TableCell>
						</TableRow>
					) : (
						approvals.map((approval) => {
							const fields = approval.extractedFields
								? JSON.parse(approval.extractedFields as string)
								: {};
							const isPending = approveMutation.isPending || rejectMutation.isPending;
							const urgencyStatus = fields.urgency === "urgent" || fields.urgency === "high" ? "error" as const : "info" as const;

							return (
								<TableRow key={approval.id}>
									<TableCell>
										<div>
											<p className="font-medium">{approval.title}</p>
											{approval.aiSummary && (
												<p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
													{approval.aiSummary}
												</p>
											)}
										</div>
									</TableCell>
									<TableCell>
										{approval.assignee ? (
											<span className="text-sm">{approval.assignee.name ?? approval.assignee.email}</span>
										) : (
											<span className="text-sm text-muted-foreground">—</span>
										)}
									</TableCell>
									<TableCell>
										{fields.urgency && (
											<Badge status={urgencyStatus}>
												{fields.urgency}
											</Badge>
										)}
									</TableCell>
									<TableCell>
										<div className="flex justify-end gap-2">
											<Button
												size="sm"
												variant="outline"
												disabled={isPending}
												onClick={() =>
													approveMutation.mutate({
														entityId: approval.id,
													})
												}
											>
												<CheckIcon className="mr-1 size-3" />
												Approve
											</Button>
											<Button
												size="sm"
												variant="destructive"
												disabled={isPending}
												onClick={() =>
													rejectMutation.mutate({
														entityId: approval.id,
														reason: "Rejected via dashboard",
													})
												}
											>
												<XIcon className="mr-1 size-3" />
												Reject
											</Button>
										</div>
									</TableCell>
								</TableRow>
							);
						})
					)}
				</TableBody>
			</Table>
		</Card>
	);
}
