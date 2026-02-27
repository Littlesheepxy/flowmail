import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Logo } from "@repo/ui";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Inter } from "next/font/google";
import { source } from "@/lib/source";

const inter = Inter({
	subsets: ["latin"],
});

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" className={inter.className} suppressHydrationWarning>
			<body className="flex flex-col min-h-screen">
				<RootProvider>
					<DocsLayout
						tree={source.getPageTree()}
						nav={{
							title: <Logo />,
						}}
					>
						{children}
					</DocsLayout>
				</RootProvider>
			</body>
		</html>
	);
}
