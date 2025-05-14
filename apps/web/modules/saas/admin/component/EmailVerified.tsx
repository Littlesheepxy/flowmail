import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@ui/components/tooltip";
import { cn } from "@ui/lib";
import { CheckIcon, ClockIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function EmailVerified({
	verified,
	className,
}: {
	verified: boolean;
	className?: string;
}) {
	const t = useTranslations();
	return (
		<TooltipProvider delayDuration={0}>
			<Tooltip>
				<TooltipContent>
					{verified
						? t("admin.users.emailVerified.verified")
						: t("admin.users.emailVerified.waiting")}
				</TooltipContent>
				<TooltipTrigger className={cn(className)}>
					{verified ? (
						<CheckIcon className="size-3 text-primary" />
					) : (
						<ClockIcon className="size-3" />
					)}
				</TooltipTrigger>
			</Tooltip>
		</TooltipProvider>
	);
}
