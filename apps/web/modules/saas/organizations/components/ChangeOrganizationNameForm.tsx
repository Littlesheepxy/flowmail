"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { organizationListQueryKey } from "@saas/organizations/lib/api";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useRouter } from "@shared/hooks/router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	name: z.string().min(3),
});

type FormSchema = z.infer<typeof formSchema>;

export function ChangeOrganizationNameForm() {
	const t = useTranslations();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { activeOrganization } = useActiveOrganization();

	const form = useForm<FormSchema>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: activeOrganization?.name ?? "",
		},
	});

	const onSubmit = form.handleSubmit(async ({ name }) => {
		if (!activeOrganization) {
			return;
		}

		try {
			const { error } = await authClient.organization.update({
				organizationId: activeOrganization.id,
				data: {
					name,
				},
			});

			if (error) {
				throw error;
			}

			toast.success(
				t(
					"organizations.settings.notifications.organizationNameUpdated",
				),
			);

			queryClient.invalidateQueries({
				queryKey: organizationListQueryKey,
			});
			router.refresh();
		} catch {
			toast.error(
				t(
					"organizations.settings.notifications.organizationNameNotUpdated",
				),
			);
		}
	});

	return (
		<SettingsItem title={t("organizations.settings.changeName.title")}>
			<form onSubmit={onSubmit}>
				<Input {...form.register("name")} />

				<div className="mt-4 flex justify-end">
					<Button
						type="submit"
						disabled={
							!(
								form.formState.isValid &&
								form.formState.dirtyFields.name
							)
						}
						loading={form.formState.isSubmitting}
					>
						{t("settings.save")}
					</Button>
				</div>
			</form>
		</SettingsItem>
	);
}
