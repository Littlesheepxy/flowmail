"use client";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { OrganizationInvitationsList } from "./OrganizationInvitationsList";
import { OrganizationMembersList } from "./OrganizationMembersList";

export function OrganizationMembersBlock({
	organizationId,
}: {
	organizationId: string;
}) {
	const t = useTranslations();
	const [activeTab, setActiveTab] = useState("members");

	return (
		<SettingsItem
			title={t("organizations.settings.members.title")}
			description={t("organizations.settings.members.description")}
		>
			<Tabs value={activeTab} onValueChange={(tab) => setActiveTab(tab)}>
				<TabsList className="mb-4">
					<TabsTrigger value="members">
						{t("organizations.settings.members.activeMembers")}
					</TabsTrigger>
					<TabsTrigger value="invitations">
						{t("organizations.settings.members.pendingInvitations")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="members">
					<OrganizationMembersList organizationId={organizationId} />
				</TabsContent>
				<TabsContent value="invitations">
					<OrganizationInvitationsList
						organizationId={organizationId}
					/>
				</TabsContent>
			</Tabs>
		</SettingsItem>
	);
}
