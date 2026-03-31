import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import "./globals.css";
import "cropperjs/dist/cropper.css";
import { config } from "@/config";

export const metadata: Metadata = {
	title: {
		absolute: config.appName,
		default: config.appName,
		template: `%s | ${config.appName}`,
	},
	description:
		"Flowmail turns your inbox into actionable workflows. AI-powered email classification, one-click approvals, and MCP-native agent integration.",
	openGraph: {
		title: config.appName,
		description:
			"Stop reading emails. Start executing. Flowmail automates approvals, reports, and tasks from your inbox.",
		siteName: config.appName,
	},
};

export default function RootLayout({ children }: PropsWithChildren) {
	return children;
}
