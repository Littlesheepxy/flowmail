import { SecurityPage } from "@marketing/security/components/SecurityPage";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export const metadata: Metadata = {
	title: "Security — Flowmail",
	description:
		"Learn how Flowmail protects your email data with AES-256 encryption, multi-factor authentication, audit logging, and more.",
};

export default async function Security({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	return <SecurityPage />;
}
