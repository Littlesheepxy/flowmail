import {
	Container,
	Font,
	Head,
	Html,
	Section,
	Tailwind,
} from "@react-email/components";
import React, { type PropsWithChildren } from "react";
import { Logo } from "./Logo";

export default function Wrapper({ children }: PropsWithChildren) {
	return (
		<Tailwind
			config={{
				theme: {
					extend: {
						colors: {
							border: "#e0e3e0",
							input: "#d0d4d0",
							ring: "#3875c8",
							background: "#f2f1ed",
							foreground: "#1c1e1e",
							primary: {
								DEFAULT: "#3875c8",
								foreground: "#ffffff",
							},
							secondary: {
								DEFAULT: "#292b35",
								foreground: "#ffffff",
							},
							muted: {
								DEFAULT: "#e8e7e3",
								foreground: "#1d1f1f",
							},
							card: {
								DEFAULT: "#f9f8f6",
								foreground: "#1d1f1f",
							},
						},
						borderRadius: {
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
						<Logo />
						{children}
					</Container>
				</Section>
			</Html>
		</Tailwind>
	);
}
