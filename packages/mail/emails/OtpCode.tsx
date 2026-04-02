import { Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import Wrapper from "../components/Wrapper";
import type { BaseMailProps } from "../types";
import { defaultLocale, defaultTranslations } from "../util/translations";

export function OtpCode({
	otp,
	type,
	locale,
	translations,
}: {
	otp: string;
	type: "sign-in" | "email-verification" | "forget-password";
} & BaseMailProps) {
	const t = createTranslator({
		locale,
		messages: translations,
	});

	return (
		<Wrapper>
			<Text>{t(`mail.otpCode.body.${type}`)}</Text>

			<Text
				style={{
					fontSize: "32px",
					fontWeight: "bold",
					letterSpacing: "0.3em",
					textAlign: "center",
					padding: "16px 0",
					fontFamily: "monospace",
				}}
			>
				{otp}
			</Text>

			<Text className="text-muted-foreground text-sm">
				{t("mail.otpCode.expiry")}
			</Text>
		</Wrapper>
	);
}

OtpCode.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	otp: "123456",
	type: "sign-in" as const,
};

export default OtpCode;
