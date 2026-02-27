"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "../lib";

const Progress = ({
	className,
	value,
	...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) => (
	<ProgressPrimitive.Root
		className={cn(
			"relative h-4 w-full overflow-hidden rounded-full bg-border",
			className,
		)}
		{...props}
	>
		<ProgressPrimitive.Indicator
			className="size-full flex-1 rounded-full bg-primary transition-all"
			style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
		/>
	</ProgressPrimitive.Root>
);

export { Progress };
