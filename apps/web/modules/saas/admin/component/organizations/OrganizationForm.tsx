"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getAdminPath } from "@saas/admin/lib/links";
import { InviteMemberForm } from "@saas/organizations/components/InviteMemberForm";
import { OrganizationMembersBlock } from "@saas/organizations/components/OrganizationMembersBlock";
import {
	fullOrganizationQueryKey,
	useCreateOrganizationMutation,
	useFullOrganizationQuery,
	useUpdateOrganizationMutation,
} from "@saas/organizations/lib/api";
import { useRouter } from "@shared/hooks/router";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@ui/components/form";
import { Input } from "@ui/components/input";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const organizationFormSchema = z.object({
	name: z.string().min(1),
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

export function OrganizationForm({
	organizationId,
}: {
	organizationId: string;
}) {
	const t = useTranslations();
	const router = useRouter();

	const { data: organization } = useFullOrganizationQuery(organizationId);

	const updateOrganizationMutation = useUpdateOrganizationMutation();
	const createOrganizationMutation = useCreateOrganizationMutation();
	const queryClient = useQueryClient();

	const form = useForm<OrganizationFormValues>({
		resolver: zodResolver(organizationFormSchema),
		defaultValues: {
			name: organization?.name ?? "",
		},
	});

	const onSubmit = form.handleSubmit(async ({ name }) => {
		try {
			const newOrganization = organization
				? await updateOrganizationMutation.mutateAsync({
						id: organization.id,
						name,
						updateSlug: organization.name !== name,
					})
				: await createOrganizationMutation.mutateAsync({
						name,
					});

			if (!newOrganization) {
				throw new Error("Could not save organization");
			}

			queryClient.setQueryData(
				fullOrganizationQueryKey(organizationId),
				newOrganization,
			);

			queryClient.invalidateQueries({
				queryKey: orpc.admin.organizations.list.key(),
			});

			toast.success(t("admin.organizations.form.notifications.success"));

			if (!organization) {
				router.replace(
					getAdminPath(`/organizations/${newOrganization.id}`),
				);
			}
		} catch {
			toast.error(t("admin.organizations.form.notifications.error"));
		}
	});

	return (
		<div className="grid grid-cols-1 gap-4">
			<Card>
				<CardHeader>
					<CardTitle>
						{organization
							? t("admin.organizations.form.updateTitle")
							: t("admin.organizations.form.createTitle")}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={onSubmit}
							className="grid grid-cols-1 gap-4"
						>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{t("admin.organizations.form.name")}
										</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="flex justify-end">
								<Button
									type="submit"
									loading={
										updateOrganizationMutation.isPending ||
										createOrganizationMutation.isPending
									}
								>
									{t("admin.organizations.form.save")}
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>

			{organization && (
				<>
					<OrganizationMembersBlock
						organizationId={organization.id}
					/>
					<InviteMemberForm organizationId={organization.id} />
				</>
			)}
		</div>
	);
}
