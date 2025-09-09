"use client";

import { authClient } from "@repo/auth/client";
import { useConfirmationAlert } from "@saas/shared/components/ConfirmationAlertProvider";
import { Pagination } from "@saas/shared/components/Pagination";
import { Spinner } from "@shared/components/Spinner";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { Input } from "@ui/components/input";
import { Table, TableBody, TableCell, TableRow } from "@ui/components/table";
import {
	MoreVerticalIcon,
	Repeat1Icon,
	ShieldCheckIcon,
	ShieldXIcon,
	SquareUserRoundIcon,
	TrashIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import { EmailVerified } from "../EmailVerified";

const ITEMS_PER_PAGE = 10;

export function UserList() {
	const t = useTranslations();
	const queryClient = useQueryClient();
	const { confirm } = useConfirmationAlert();
	const [currentPage, setCurrentPage] = useQueryState(
		"currentPage",
		parseAsInteger.withDefault(1),
	);
	const [searchTerm, setSearchTerm] = useQueryState(
		"query",
		parseAsString.withDefault(""),
	);
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useDebounceValue(
		searchTerm,
		300,
		{
			leading: true,
			trailing: false,
		},
	);

	useEffect(() => {
		setDebouncedSearchTerm(searchTerm);
	}, [searchTerm]);

	const { data, isLoading, refetch } = useQuery(
		orpc.admin.users.list.queryOptions({
			input: {
				itemsPerPage: ITEMS_PER_PAGE,
				currentPage,
				searchTerm: debouncedSearchTerm,
			},
		}),
	);

	useEffect(() => {
		setCurrentPage(1);
	}, [debouncedSearchTerm]);

	const impersonateUser = async (
		userId: string,
		{ name }: { name: string },
	) => {
		const toastId = toast.loading(
			t("admin.users.impersonation.impersonating", {
				name,
			}),
		);

		await authClient.admin.impersonateUser({
			userId,
		});
		await refetch();
		toast.dismiss(toastId);
		window.location.href = new URL(
			"/app",
			window.location.origin,
		).toString();
	};

	const deleteUser = async (id: string) => {
		toast.promise(
			async () => {
				const { error } = await authClient.admin.removeUser({
					userId: id,
				});

				if (error) {
					throw error;
				}
			},
			{
				loading: t("admin.users.deleteUser.deleting"),
				success: () => {
					return t("admin.users.deleteUser.deleted");
				},
				error: t("admin.users.deleteUser.notDeleted"),
			},
		);
	};

	const resendVerificationMail = async (email: string) => {
		toast.promise(
			async () => {
				const { error } = await authClient.sendVerificationEmail({
					email,
				});

				if (error) {
					throw error;
				}
			},
			{
				loading: t("admin.users.resendVerificationMail.submitting"),
				success: () => {
					return t("admin.users.resendVerificationMail.success");
				},
				error: t("admin.users.resendVerificationMail.error"),
			},
		);
	};

	const assignAdminRole = async (id: string) => {
		await authClient.admin.setRole({
			userId: id,
			role: "admin",
		});

		await queryClient.invalidateQueries({
			queryKey: orpc.admin.users.list.key(),
		});
	};

	const removeAdminRole = async (id: string) => {
		await authClient.admin.setRole({
			userId: id,
			role: "user",
		});

		await queryClient.invalidateQueries({
			queryKey: orpc.admin.users.list.key(),
		});
	};

	const columns: ColumnDef<
		NonNullable<
			Awaited<ReturnType<typeof authClient.admin.listUsers>>["data"]
		>["users"][number]
	>[] = useMemo(
		() => [
			{
				accessorKey: "user",
				header: "",
				accessorFn: (row) => row.name,
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<UserAvatar
							name={row.original.name ?? row.original.email}
							avatarUrl={row.original.image}
						/>
						<div className="leading-tight">
							<strong className="block">
								{row.original.name ?? row.original.email}
							</strong>
							<small className="flex items-center gap-1 text-foreground/60">
								<span className="block">
									{!!row.original.name && row.original.email}
								</span>
								<EmailVerified
									verified={row.original.emailVerified}
								/>
								<strong className="block">
									{row.original.role === "admin"
										? "Admin"
										: ""}
								</strong>
							</small>
						</div>
					</div>
				),
			},
			{
				accessorKey: "actions",
				header: "",
				cell: ({ row }) => {
					return (
						<div className="flex flex-row justify-end gap-2">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button size="icon" variant="ghost">
										<MoreVerticalIcon className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<DropdownMenuItem
										onClick={() =>
											impersonateUser(row.original.id, {
												name: row.original.name ?? "",
											})
										}
									>
										<SquareUserRoundIcon className="mr-2 size-4" />
										{t("admin.users.impersonate")}
									</DropdownMenuItem>

									{!row.original.emailVerified && (
										<DropdownMenuItem
											onClick={() =>
												resendVerificationMail(
													row.original.email,
												)
											}
										>
											<Repeat1Icon className="mr-2 size-4" />
											{t(
												"admin.users.resendVerificationMail.title",
											)}
										</DropdownMenuItem>
									)}

									{row.original.role !== "admin" ? (
										<DropdownMenuItem
											onClick={() =>
												assignAdminRole(row.original.id)
											}
										>
											<ShieldCheckIcon className="mr-2 size-4" />
											{t("admin.users.assignAdminRole")}
										</DropdownMenuItem>
									) : (
										<DropdownMenuItem
											onClick={() =>
												removeAdminRole(row.original.id)
											}
										>
											<ShieldXIcon className="mr-2 size-4" />
											{t("admin.users.removeAdminRole")}
										</DropdownMenuItem>
									)}

									<DropdownMenuItem
										onClick={() =>
											confirm({
												title: t(
													"admin.users.confirmDelete.title",
												),
												message: t(
													"admin.users.confirmDelete.message",
												),
												confirmLabel: t(
													"admin.users.confirmDelete.confirm",
												),
												destructive: true,
												onConfirm: () =>
													deleteUser(row.original.id),
											})
										}
									>
										<span className="flex items-center text-destructive hover:text-destructive">
											<TrashIcon className="mr-2 size-4" />
											{t("admin.users.delete")}
										</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					);
				},
			},
		],
		[],
	);

	const users = useMemo(() => data?.users ?? [], [data?.users]);

	const table = useReactTable({
		data: users,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		manualPagination: true,
	});

	return (
		<Card className="p-6">
			<h2 className="mb-4 font-semibold text-2xl">
				{t("admin.users.title")}
			</h2>
			<Input
				type="search"
				placeholder={t("admin.users.search")}
				value={searchTerm}
				onChange={(e) => setSearchTerm(e.target.value)}
				className="mb-4"
			/>

			<div className="rounded-md border">
				<Table>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={
										row.getIsSelected() && "selected"
									}
									className="group"
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className="py-2 group-first:rounded-t-md group-last:rounded-b-md"
										>
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
									{isLoading ? (
										<div className="flex h-full items-center justify-center">
											<Spinner className="mr-2 size-4 text-primary" />
											{t("admin.users.loading")}
										</div>
									) : (
										<p>No results.</p>
									)}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{data?.total && data.total > ITEMS_PER_PAGE && (
				<Pagination
					className="mt-4"
					totalItems={data.total}
					itemsPerPage={ITEMS_PER_PAGE}
					currentPage={currentPage}
					onChangeCurrentPage={setCurrentPage}
				/>
			)}
		</Card>
	);
}
