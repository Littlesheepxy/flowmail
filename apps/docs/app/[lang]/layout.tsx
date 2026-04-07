import { Logo } from "@repo/ui";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { i18nUI } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default async function LangLayout({
	params,
	children,
}: {
	params: Promise<{ lang: string }>;
	children: React.ReactNode;
}) {
	const { lang } = await params;

	return (
		<RootProvider i18n={i18nUI.provider(lang)}>
			<DocsLayout
				tree={source.getPageTree(lang)}
				nav={{
					title: <Logo />,
				}}
				i18n
			>
				{children}
			</DocsLayout>
		</RootProvider>
	);
}
