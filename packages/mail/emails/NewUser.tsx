import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function NewUser({
	url,
	name,
	otp,
	locale,
	translations,
}: {
	url: string;
	name: string;
	otp: string;
} & BaseMailProps) {
	const t = createTranslator({
		locale,
		messages: translations,
	});

	return (
		<Wrapper>
			<Text>{t("mail.newUser.body", { name })}</Text>

			<Text>
				{t("mail.common.otp")}
				<br />
				<strong className="font-bold text-2xl">{otp}</strong>
			</Text>

			<Text>{t("mail.common.useLink")}</Text>

			<PrimaryButton href={url}>
				{t("mail.newUser.confirmEmail")} &rarr;
			</PrimaryButton>

			<Text className="text-muted-foreground text-sm">
				{t("mail.common.openLinkInBrowser")}
				<Link href={url}>{url}</Link>
			</Text>
		</Wrapper>
	);
}

NewUser.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	url: "#",
	name: "John Doe",
	otp: "123456",
};

export default NewUser;
