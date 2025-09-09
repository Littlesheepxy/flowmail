import { cn } from "@ui/lib";
import * as React from "react";

const Textarea = ({
	className,
	...props
}: React.ComponentProps<"textarea">) => {
	return (
		<textarea
			className={cn(
				"flex min-h-[80px] w-full rounded-md bg-card shadow-xs border border-input px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				className,
			)}
			{...props}
		/>
	);
};

export { Textarea };
