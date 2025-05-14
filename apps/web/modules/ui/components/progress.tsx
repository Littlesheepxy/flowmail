"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";

import { cn } from "@ui/lib";

const Progress = React.forwardRef<
	React.ComponentRef<typeof ProgressPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
	<ProgressPrimitive.Root
		ref={ref}
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
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
