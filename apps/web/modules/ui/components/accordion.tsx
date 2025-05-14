"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import * as React from "react";

import { cn } from "@ui/lib";
import { ChevronDownIcon } from "lucide-react";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
	React.ComponentRef<typeof AccordionPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
	<AccordionPrimitive.Item
		ref={ref}
		className={cn("border-b", className)}
		{...props}
	/>
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
	React.ComponentRef<typeof AccordionPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
	<AccordionPrimitive.Header className="flex">
		<AccordionPrimitive.Trigger
			ref={ref}
			className={cn(
				"flex flex-1 items-center justify-between py-4 font-medium text-sm transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
				className,
			)}
			{...props}
		>
			{children}
			<ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
		</AccordionPrimitive.Trigger>
	</AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
	React.ComponentRef<typeof AccordionPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
	<AccordionPrimitive.Content
		ref={ref}
		className={cn(
			"overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
			className,
		)}
		{...props}
	>
		<div className="pt-0 pb-4">{children}</div>
	</AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
