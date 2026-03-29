"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
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
import { MailIcon, PlusIcon } from "lucide-react";

export function EmailConnectionsList() {
	const { activeOrganization } = useActiveOrganization();

	const { data, isLoading } = useQuery(
		orpc.emailConnections.list.queryOptions({
			input: {
				organizationId: activeOrganization?.id ?? "",
			},
		}),
	);

	const connections = data ?? [];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-lg">Connected Email Accounts</h3>
					<p className="text-sm text-muted-foreground">
						Flowmail watches these inboxes and extracts business items automatically.
					</p>
				</div>
				<Button disabled>
					<PlusIcon className="mr-2 size-4" />
					Connect Gmail
				</Button>
			</div>

			<Card className="p-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Email</TableHead>
							<TableHead>Provider</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Last Synced</TableHead>
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
						) : connections.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
									<div className="flex flex-col items-center gap-2">
										<MailIcon className="size-8 text-muted-foreground/50" />
										<p>No email accounts connected</p>
										<p className="text-xs">Connect a Gmail account to start processing emails.</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							connections.map((conn) => (
								<TableRow key={conn.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											<MailIcon className="size-4 text-muted-foreground" />
											<span className="font-medium">{conn.email}</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge status="info">{conn.provider}</Badge>
									</TableCell>
									<TableCell>
										<Badge status={conn.isActive ? "success" : "error"}>
											{conn.isActive ? "Active" : "Inactive"}
										</Badge>
									</TableCell>
									<TableCell className="text-right text-sm text-muted-foreground">
										{conn.lastSyncAt
											? new Date(conn.lastSyncAt).toLocaleString()
											: "Never"}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</Card>
		</div>
	);
}
