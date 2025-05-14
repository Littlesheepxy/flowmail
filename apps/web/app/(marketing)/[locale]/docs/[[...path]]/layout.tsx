import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { getTranslations } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { docsSource } from "../../../../docs-source";

export default async function DocumentationLayout({
	children,
	params,
}: PropsWithChildren<{
	params: Promise<{ locale: string }>;
}>) {
	const t = await getTranslations();
	const { locale } = await params;

	return (
		<div className="pt-[4.5rem]">
			<DocsLayout
				tree={docsSource.pageTree[locale]}
				disableThemeSwitch
				i18n
				nav={{
					title: <strong>{t("documentation.title")}</strong>,
					url: "/docs",
				}}
				sidebar={{
					defaultOpenLevel: 1,
				}}
			>
				{children}
			</DocsLayout>
		</div>
	);
}
