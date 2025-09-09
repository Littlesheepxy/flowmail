"use client";

import { authClient } from "@repo/auth/client";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import { organizationListQueryKey } from "@saas/organizations/lib/api";
import { useRouter } from "@shared/hooks/router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function OrganizationInvitationModal({
	invitationId,
	organizationName,
	organizationSlug,
	logoUrl,
}: {
	invitationId: string;
	organizationName: string;
	organizationSlug: string;
	logoUrl?: string;
}) {
	const t = useTranslations();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [submitting, setSubmitting] = useState<false | "accept" | "reject">(
		false,
	);

	const onSelectAnswer = async (accept: boolean) => {
		setSubmitting(accept ? "accept" : "reject");
		try {
			if (accept) {
				const { error } =
					await authClient.organization.acceptInvitation({
						invitationId,
					});

				if (error) {
					throw error;
				}

				await queryClient.invalidateQueries({
					queryKey: organizationListQueryKey,
				});

				router.replace(`/app/${organizationSlug}`);
			} else {
				const { error } =
					await authClient.organization.rejectInvitation({
						invitationId,
					});

				if (error) {
					throw error;
				}

				router.replace("/app");
			}
		} catch {
			// TODO: handle error
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div>
			<h1 className="font-bold text-xl md:text-2xl">
				{t("organizations.invitationModal.title")}
			</h1>
			<p className="mt-1 mb-6 text-foreground/60">
				{t("organizations.invitationModal.description", {
					organizationName,
				})}
			</p>

			<div className="mb-6 flex items-center gap-3 rounded-lg border p-2">
				<OrganizationLogo
					name={organizationName}
					logoUrl={logoUrl}
					className="size-12"
				/>
				<div>
					<strong className="font-medium text-lg">
						{organizationName}
					</strong>
				</div>
			</div>

			<div className="flex gap-2">
				<Button
					className="flex-1"
					variant="light"
					onClick={() => onSelectAnswer(false)}
					disabled={!!submitting}
					loading={submitting === "reject"}
				>
					<XIcon className="mr-1.5 size-4" />
					{t("organizations.invitationModal.decline")}
				</Button>
				<Button
					className="flex-1"
					onClick={() => onSelectAnswer(true)}
					disabled={!!submitting}
					loading={submitting === "accept"}
				>
					<CheckIcon className="mr-1.5 size-4" />
					{t("organizations.invitationModal.accept")}
				</Button>
			</div>
		</div>
	);
}
