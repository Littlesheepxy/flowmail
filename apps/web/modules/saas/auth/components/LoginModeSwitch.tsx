"use client";

import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { useTranslations } from "next-intl";

export function LoginModeSwitch({
	activeMode,
	onChange,
	className,
}: {
	activeMode: "password" | "email-otp";
	onChange: (mode: string) => void;
	className?: string;
}) {
	const t = useTranslations();
	return (
		<Tabs value={activeMode} onValueChange={onChange} className={className}>
			<TabsList className="w-full">
				<TabsTrigger value="password" className="flex-1">
					{t("auth.login.modes.password")}
				</TabsTrigger>
				<TabsTrigger value="email-otp" className="flex-1">
					{t("auth.login.modes.emailOtp")}
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
