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
		<Html lang="en">
			<Head>
				<Font
					fontFamily="Inter"
					fallbackFontFamily="Arial"
					fontWeight={400}
					fontStyle="normal"
				/>
			</Head>
			<Tailwind
				config={{
					theme: {
						extend: {
							colors: {
								border: "#e3ebf6",
								background: "#fafafe",
								foreground: "#292b35",
								primary: {
									DEFAULT: "#4e6df5",
									foreground: "#f6f7f9",
								},
								secondary: {
									DEFAULT: "#292b35",
									foreground: "#ffffff",
								},
								card: {
									DEFAULT: "#ffffff",
									foreground: "#292b35",
								},
							},
						},
					},
				}}
			>
				<Section className="bg-background p-4">
					<Container className="rounded-lg bg-card p-6 text-card-foreground">
						<Logo />
						{children}
					</Container>
				</Section>
			</Tailwind>
		</Html>
	);
}
