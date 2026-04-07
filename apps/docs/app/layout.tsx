import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./global.css";

const inter = Inter({
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: { default: "Flowmail Docs", template: "%s | Flowmail Docs" },
	icons: {
		icon: [
			{ url: "/favicon.ico", sizes: "any" },
			{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
		],
		apple: "/apple-touch-icon.png",
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className={inter.className} suppressHydrationWarning>
			<body className="flex flex-col min-h-screen">{children}</body>
		</html>
	);
}
