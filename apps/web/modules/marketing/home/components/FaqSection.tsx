"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@ui/components/accordion";
import { cn } from "@ui/lib";
import { useTranslations } from "next-intl";

export function FaqSection({ className }: { className?: string }) {
	const t = useTranslations();

	const items = [
		{
			question: "What is the refund policy?",
			answer: "We offer a 30-day money-back guarantee if you're not happy with our product.",
		},
		{
			question: "How do I cancel my subscription?",
			answer: "You can cancel your subscription by visiting the billing page.",
		},
		{
			question: "Can I change my plan?",
			answer: "Yes, you can change your plan at any time by visiting the billing page.",
		},
		{
			question: "Do you offer a free trial?",
			answer: "Yes, we offer a 14-day free trial.",
		},
	];

	if (!items) {
		return null;
	}

	return (
		<section
			className={cn("scroll-mt-20 py-12 lg:py-16 xl:py-24", className)}
			id="faq"
		>
			<div className="container max-w-3xl">
				<div className="mb-6 text-center">
					<h1 className="mb-2 font-serif font-medium text-xl md:text-2xl lg:text-3xl xl:text-4xl leading-tighter text-foreground">
						{t("faq.title")}
					</h1>
					<p className="text-foreground/60 text-sm sm:text-lg">
						{t("faq.description")}
					</p>
				</div>
				<Accordion
					type="single"
					collapsible
					className="w-full space-y-2"
				>
					{items.map((item, i) => (
						<AccordionItem
							key={`faq-item-${i}`}
							value={`item-${i}`}
							className="rounded-lg bg-card shadow-none border-none px-4 lg:px-6"
						>
							<AccordionTrigger className="text-left font-medium text-base hover:no-underline">
								{item.question}
							</AccordionTrigger>
							<AccordionContent className="text-foreground/60">
								{item.answer}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>
		</section>
	);
}
