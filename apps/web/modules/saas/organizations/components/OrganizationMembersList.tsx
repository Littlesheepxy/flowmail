"use client";
import type { OrganizationMemberRole } from "@repo/auth";
import { authClient } from "@repo/auth/client";
import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { useSession } from "@saas/auth/hooks/use-session";
import { useOrganizationMemberRoles } from "@saas/organizations/hooks/member-roles";
import {
	fullOrganizationQueryKey,
	useFullOrganizationQuery,
} from "@saas/organizations/lib/api";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useQueryClient } from "@tanstack/react-query";
import type {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
} from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Button } from "@ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { Table, TableBody, TableCell, TableRow } from "@ui/components/table";
import { LogOutIcon, MoreVerticalIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { OrganizationRoleSelect } from "./OrganizationRoleSelect";

export function OrganizationMembersList({
	organizationId,
}: {
	organizationId: string;
}) {
	const t = useTranslations();
	const queryClient = useQueryClient();
	const { user } = useSession();
	const { data: organization } = useFullOrganizationQuery(organizationId);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const memberRoles = useOrganizationMemberRoles();

	const userIsOrganizationAdmin = isOrganizationAdmin(organization, user);

	const updateMemberRole = async (
		memberId: string,
		role: OrganizationMemberRole,
	) => {
		toast.promise(
			async () => {
				await authClient.organization.updateMemberRole({
					memberId,
					role,
					organizationId,
				});
			},
			{
				loading: t(
					"organizations.settings.members.notifications.updateMembership.loading.description",
				),
				success: () => {
					queryClient.invalidateQueries({
						queryKey: fullOrganizationQueryKey(organizationId),
					});

					return t(
						"organizations.settings.members.notifications.updateMembership.success.description",
					);
				},
				error: t(
					"organizations.settings.members.notifications.updateMembership.error.description",
				),
			},
		);
	};

	const removeMember = async (memberId: string) => {
		toast.promise(
			async () => {
				await authClient.organization.removeMember({
					memberIdOrEmail: memberId,
					organizationId,
				});
			},
			{
				loading: t(
					"organizations.settings.members.notifications.removeMember.loading.description",
				),
				success: () => {
					queryClient.invalidateQueries({
						queryKey: fullOrganizationQueryKey(organizationId),
					});

					return t(
						"organizations.settings.members.notifications.removeMember.success.description",
					);
				},
				error: t(
					"organizations.settings.members.notifications.removeMember.error.description",
				),
			},
		);
	};

	const columns: ColumnDef<
		NonNullable<typeof organization>["members"][number]
	>[] = [
		{
			accessorKey: "user",
			header: "",
			accessorFn: (row) => row.user,
			cell: ({ row }) =>
				row.original.user ? (
					<div className="flex items-center gap-2">
						<UserAvatar
							name={
								row.original.user.name ??
								row.original.user.email
							}
							avatarUrl={row.original.user?.image}
						/>
						<div>
							<strong className="block">
								{row.original.user.name}
							</strong>
							<small className="text-foreground/60">
								{row.original.user.email}
							</small>
						</div>
					</div>
				) : null,
		},
		{
			accessorKey: "actions",
			header: "",
			cell: ({ row }) => {
				return (
					<div className="flex flex-row justify-end gap-2">
						{userIsOrganizationAdmin ? (
							<>
								<OrganizationRoleSelect
									value={row.original.role}
									onSelect={async (value) =>
										updateMemberRole(row.original.id, value)
									}
									disabled={
										!userIsOrganizationAdmin ||
										row.original.role === "owner"
									}
								/>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button size="icon" variant="ghost">
											<MoreVerticalIcon className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent>
										{row.original.userId !== user?.id && (
											<DropdownMenuItem
												disabled={
													!isOrganizationAdmin(
														organization,
														user,
													)
												}
												className="text-destructive"
												onClick={async () =>
													removeMember(
														row.original.id,
													)
												}
											>
												<TrashIcon className="mr-2 size-4" />
												{t(
													"organizations.settings.members.removeMember",
												)}
											</DropdownMenuItem>
										)}
										{row.original.userId === user?.id && (
											<DropdownMenuItem
												className="text-destructive"
												onClick={async () =>
													removeMember(
														row.original.id,
													)
												}
											>
												<LogOutIcon className="mr-2 size-4" />
												{t(
													"organizations.settings.members.leaveOrganization",
												)}
											</DropdownMenuItem>
										)}
									</DropdownMenuContent>
								</DropdownMenu>
							</>
						) : (
							<span className="font-medium text-foreground/60 text-sm">
								{
									memberRoles[
										row.original
											.role as keyof typeof memberRoles
									]
								}
							</span>
						)}
					</div>
				);
			},
		},
	];

	const table = useReactTable({
		data: organization?.members ?? [],
		columns,
		manualPagination: true,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		state: {
			sorting,
			columnFilters,
		},
	});

	return (
		<div className="rounded-md border">
			<Table>
				<TableBody>
					{table.getRowModel().rows?.length ? (
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={row.id}
								data-state={row.getIsSelected() && "selected"}
							>
								{row.getVisibleCells().map((cell) => (
									<TableCell key={cell.id}>
										{flexRender(
											cell.column.columnDef.cell,
											cell.getContext(),
										)}
									</TableCell>
								))}
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className="h-24 text-center"
							>
								No results.
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
