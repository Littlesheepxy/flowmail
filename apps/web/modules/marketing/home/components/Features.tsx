"use client";

import { MobileIcon } from "@radix-ui/react-icons";
import { cn } from "@ui/lib";
import {
	CloudIcon,
	ComputerIcon,
	PaperclipIcon,
	StarIcon,
	WandIcon,
} from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { type JSXElementConstructor, type ReactNode, useState } from "react";
import heroImage from "../../../../public/images/hero.svg";

export const featureTabs: Array<{
	id: string;
	title: string;
	icon: JSXElementConstructor<any>;
	subtitle?: string;
	description?: ReactNode;
	image?: StaticImageData;
	imageBorder?: boolean;
	stack?: {
		title: string;
		href: string;
		icon: JSXElementConstructor<any>;
	}[];
	highlights?: {
		title: string;
		description: string;
		icon: JSXElementConstructor<any>;
		demoLink?: string;
		docsLink?: string;
	}[];
}> = [
	{
		id: "feature1",
		title: "Feature 1",
		icon: StarIcon,
		subtitle: "Do more with our amazing SaaS.",
		description:
			"This is a brilliant feature. And below you can see some reasons why. This is basically just a dummy text.",
		stack: [],
		image: heroImage,
		imageBorder: false,
		highlights: [
			{
				title: "Benefit 1",
				description:
					"This is an awesome benefit. And below you can see some reasons why. This is basically just a dummy text.",
				icon: WandIcon,
			},
			{
				title: "Benefit 2",
				description:
					"This is an awesome benefit. And below you can see some reasons why. This is basically just a dummy text.",
				icon: ComputerIcon,
			},
			{
				title: "Benefit 3",
				description:
					"This is an awesome benefit. And below you can see some reasons why. This is basically just a dummy text.",
				icon: MobileIcon,
			},
		],
	},
	{
		id: "feature2",
		title: "Feature 2",
		icon: CloudIcon,
		subtitle: "Your SaaS can also do this.",
		description: "Another dummy text for another feature.",
		stack: [],
		image: heroImage,
		imageBorder: false,
		highlights: [
			{
				title: "Benefit 1",
				description:
					"This is an awesome benefit. And below you can see some reasons why. This is basically just a dummy text.",
				icon: WandIcon,
			},
			{
				title: "Benefit 2",
				description:
					"This is an awesome benefit. And below you can see some reasons why. This is basically just a dummy text.",
				icon: ComputerIcon,
			},
			{
				title: "Benefit 3",
				description:
					"This is an awesome benefit. And below you can see some reasons why. This is basically just a dummy text.",
				icon: MobileIcon,
			},
		],
	},
	{
		id: "feature3",
		title: "Feature 3",
		icon: PaperclipIcon,
		subtitle: "We even got a third one.",
		description:
			"Of course your SaaS will have more features than this, but this is just a dummy text.",
		stack: [],
		image: heroImage,
		imageBorder: false,
		highlights: [
			{
				title: "Benefit 1",
				description:
					"This is an awesome benefit. And below you can see some reasons why. This is basically just a dummy text.",
				icon: WandIcon,
			},
			{
				title: "Benefit 2",
				description:
					"This is an awesome benefit. And below you can see some reasons why. This is basically just a dummy text.",
				icon: ComputerIcon,
			},
			{
				title: "Benefit 3",
				description:
					"This is an awesome benefit. And below you can see some reasons why. This is basically just a dummy text.",
				icon: MobileIcon,
			},
		],
	},
];

export function Features() {
	const [selectedTab, setSelectedTab] = useState(featureTabs[0].id);
	return (
		<section id="features" className="scroll-my-20 pt-12 lg:pt-16">
			<div className="container max-w-5xl">
				<div className="mx-auto mb-6 lg:mb-0 lg:max-w-5xl lg:text-center">
					<h2 className="font-bold text-4xl lg:text-5xl">
						Features your clients will love
					</h2>
					<p className="mt-6 text-balance text-lg opacity-50">
						In this section you can showcase all the features of
						your SaaS provides and how they can benefit your
						clients.
					</p>
				</div>

				<div className="mt-8 mb-4 hidden justify-center lg:flex">
					{featureTabs.map((tab) => {
						return (
							<button
								type="button"
								key={tab.id}
								onClick={() => setSelectedTab(tab.id)}
								className={cn(
									"flex w-24 flex-col items-center gap-2 rounded-lg px-4 py-2 md:w-32",
									selectedTab === tab.id
										? "bg-primary/5 font-bold text-primary dark:bg-primary/10"
										: "font-medium text-foreground/80",
								)}
							>
								<tab.icon
									className={cn(
										"size-6 md:size-8",
										selectedTab === tab.id
											? "text-primary"
											: "text-foreground opacity-30",
									)}
								/>
								<span className="text-xs md:text-sm">
									{tab.title}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			<div>
				<div className="container max-w-5xl">
					{featureTabs.map((tab) => {
						const filteredStack = tab.stack || [];
						const filteredHighlights = tab.highlights || [];
						return (
							<div
								key={tab.id}
								className={cn(
									"border-t py-8 first:border-t-0 md:py-12 lg:border lg:first:border-t lg:rounded-3xl lg:p-6",
									selectedTab === tab.id
										? "block"
										: "block lg:hidden",
								)}
							>
								<div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 lg:gap-12">
									<div>
										<h3 className="font-normal text-2xl text-foreground/60 leading-normal md:text-3xl">
											<strong className="text-secondary">
												{tab.title}.{" "}
											</strong>
											{tab.subtitle}
										</h3>

										{tab.description && (
											<p className="mt-4 text-foreground/60">
												{tab.description}
											</p>
										)}

										{filteredStack?.length > 0 && (
											<div className="mt-4 flex flex-wrap gap-6">
												{filteredStack.map(
													(tool, k) => (
														<a
															href={tool.href}
															target="_blank"
															key={`stack-tool-${k}`}
															className="flex items-center gap-2"
															rel="noreferrer"
														>
															<tool.icon className="size-6" />
															<strong className="block text-sm">
																{tool.title}
															</strong>
														</a>
													),
												)}
											</div>
										)}
									</div>
									<div>
										{tab.image && (
											<Image
												src={tab.image}
												alt={tab.title}
												className={cn(
													" h-auto w-full max-w-xl",
													{
														"rounded-2xl border-4 border-secondary/10":
															tab.imageBorder,
													},
												)}
											/>
										)}
									</div>
								</div>

								{filteredHighlights.length > 0 && (
									<div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
										{filteredHighlights.map(
											(highlight, k) => (
												<div
													key={`highlight-${k}`}
													className="flex flex-col items-stretch justify-between rounded-xl bg-card border p-4"
												>
													<div>
														<highlight.icon
															className="text-primary text-xl"
															width="1em"
															height="1em"
														/>
														<strong className="mt-2 block">
															{highlight.title}
														</strong>
														<p className="mt-1 text-sm opacity-50">
															{
																highlight.description
															}
														</p>
													</div>
												</div>
											),
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
