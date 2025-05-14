import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import "./globals.css";
import "cropperjs/dist/cropper.css";

export const metadata: Metadata = {
	title: {
		absolute: "supastarter.nextjs - Application",
		default: "supastarter.nextjs- Application",
		template: "%s | supastarter.nextjs - Application",
	},
};

export default function RootLayout({ children }: PropsWithChildren) {
	return children;
}
