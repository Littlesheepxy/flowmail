"use client";

import { cn } from "@repo/ui";
import {
	CloudIcon,
	ComputerIcon,
	SmartphoneIcon,
	StarIcon,
	WandIcon,
} from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import type { JSXElementConstructor, ReactNode } from "react";
import heroImage from "../../../../public/images/feature.svg";

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
				icon: SmartphoneIcon,
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
				icon: SmartphoneIcon,
			},
		],
	},
];

export function Features() {
	return (
		<section id="features" className="scroll-my-20 py-12 lg:py-16 xl:py-24">
			<div className="container">
				<div className="mb-6 lg:mb-0 max-w-3xl">
					<small className="font-medium text-xs uppercase tracking-wider text-primary mb-4 block">
						Incredible features
					</small>
					<h2 className="text-3xl lg:text-4xl xl:text-5xl font-medium">
						Features your clients will love
					</h2>
					<p className="mt-2 text-base lg:text-lg text-foreground/60">
						In this section you can showcase all the features of
						your SaaS provides and how they can benefit your
						clients.
					</p>
				</div>
			</div>

			<div>
				<div className="container mt-8 lg:mt-12 grid grid-cols-1 gap-8 md:gap-12 lg:gap-16 xl:gap-24">
					{featureTabs.map((tab) => {
						const filteredStack = tab.stack || [];
						const filteredHighlights = tab.highlights || [];
						return (
							<div key={tab.id} className="">
								<div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
									<div>
										{tab.image && (
											<Image
												src={tab.image}
												alt={tab.title}
												className={cn(
													" h-auto w-full max-w-xl",
													{
														"rounded-2xl border-4":
															tab.imageBorder,
													},
												)}
											/>
										)}
									</div>

									<div>
										<h3 className="font-normal text-lg text-foreground leading-tight md:text-xl lg:text-2xl">
											<span className="font-medium">
												{tab.title}.{" "}
											</span>
											<span className="font-sans">
												{tab.subtitle}
											</span>
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
								</div>

								{filteredHighlights.length > 0 && (
									<div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:mt-12">
										{filteredHighlights.map(
											(highlight, k) => (
												<div
													key={`highlight-${k}`}
													className="flex flex-col items-stretch justify-between rounded-2xl p-4 lg:p-6 bg-card"
												>
													<div>
														<highlight.icon
															className="text-primary text-xl"
															width="1em"
															height="1em"
														/>
														<strong className="mt-2 block font-medium text-lg">
															{highlight.title}
														</strong>
														<p className="mt-1 text-sm">
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
