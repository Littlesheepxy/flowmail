import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function EmailVerification({
	url,
	name,
	locale,
	translations,
}: {
	url: string;
	name: string;
} & BaseMailProps) {
	const t = createTranslator({
		locale,
		messages: translations,
	});

	return (
		<Wrapper>
			<Text>{t("mail.emailVerification.body", { name })}</Text>

			<PrimaryButton href={url}>
				{t("mail.emailVerification.confirmEmail")} &rarr;
			</PrimaryButton>

			<Text className="text-muted-foreground text-sm">
				{t("mail.common.openLinkInBrowser")}
				<Link href={url} className="break-all">
					{url}
				</Link>
			</Text>
		</Wrapper>
	);
}

EmailVerification.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	url: "#",
	name: "John Doe",
};

export default EmailVerification;
