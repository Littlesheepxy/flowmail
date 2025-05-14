import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { MailCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function OrganizationInvitationAlert({
	className,
}: { className?: string }) {
	const t = useTranslations();
	return (
		<Alert variant="primary" className={className}>
			<MailCheckIcon className="size-6" />
			<AlertTitle>{t("organizations.invitationAlert.title")}</AlertTitle>
			<AlertDescription>
				{t("organizations.invitationAlert.description")}
			</AlertDescription>
		</Alert>
	);
}
