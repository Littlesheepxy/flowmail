"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@ui/lib";
import * as React from "react";

const Tabs = TabsPrimitive.Root;

const TabsList = ({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) => (
	<TabsPrimitive.List
		className={cn(
			"inline-flex items-center justify-center border-b-2 text-card-foreground/80 text-sm",
			className,
		)}
		{...props}
	/>
);

const TabsTrigger = ({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) => (
	<TabsPrimitive.Trigger
		className={cn(
			"-mb-0.5 inline-flex items-center justify-center whitespace-nowrap border-transparent border-b-2 px-3 py-2 font-medium text-foreground/60 text-sm ring-offset-background transition-all hover:text-foreground/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-card-foreground",
			className,
		)}
		{...props}
	/>
);

const TabsContent = ({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) => (
	<TabsPrimitive.Content
		className={cn(
			"mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			className,
		)}
		{...props}
	/>
);

export { Tabs, TabsContent, TabsList, TabsTrigger };
