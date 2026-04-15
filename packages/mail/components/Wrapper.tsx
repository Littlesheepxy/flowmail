import {
	Container,
	Font,
	Head,
	Html,
	Img,
	Section,
	Tailwind,
} from "@react-email/components";
import React, { type PropsWithChildren } from "react";

const baseUrl =
	process.env.NEXT_PUBLIC_SITE_URL ??
	(process.env.NEXT_PUBLIC_VERCEL_URL
		? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
		: "http://localhost:3000");

export default function Wrapper({ children }: PropsWithChildren) {
	return (
		<Tailwind
			config={{
				theme: {
					extend: {
						colors: {
							border: "#eaeaea",
							input: "#dfdfdf",
							ring: "#3875c8",
							background: "#f8f8f8",
							foreground: "#313539",
							primary: {
								DEFAULT: "#3875c8",
								foreground: "#ffffff",
							},
							secondary: {
								DEFAULT: "#e4e3e1",
								foreground: "#1c1e1e",
							},
							destructive: {
								DEFAULT: "#ef4444",
								foreground: "#ffffff",
							},
							success: {
								DEFAULT: "#39a561",
								foreground: "#ffffff",
							},
							muted: {
								DEFAULT: "#f0f0f0",
								foreground: "#4d5155",
							},
							accent: {
								DEFAULT: "#e2e6ec",
								foreground: "#313539",
							},
							popover: {
								DEFAULT: "#ffffff",
								foreground: "#313539",
							},
							card: {
								DEFAULT: "#ffffff",
								foreground: "#313539",
							},
						},
						borderRadius: {
							lg: "0.75rem",
							md: "calc(0.75rem - 2px)",
							sm: "calc(0.75rem - 4px)",
							DEFAULT: "0.75rem",
						},
					},
				},
			}}
		>
			<Html lang="en">
				<Head>
					<Font
						fontFamily="Inter"
						fallbackFontFamily="Arial"
						fontWeight={400}
						fontStyle="normal"
					/>
				</Head>
				<Section className="bg-background p-4">
					<Container className="rounded-lg bg-card p-6 text-card-foreground">
						<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
							<Img
								src={`${baseUrl}/logo-dark.png`}
								alt="Flowmail"
								width={28}
								height={28}
							/>
							<span style={{ fontSize: "16px", fontWeight: 600, letterSpacing: "-0.01em" }}>
								Flowmail
							</span>
						</div>
						{children}
					</Container>
				</Section>
			</Html>
		</Tailwind>
	);
}
