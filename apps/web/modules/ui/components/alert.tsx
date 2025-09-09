import { cn } from "@ui/lib";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import * as React from "react";

const alertVariants = cva(
	"relative w-full rounded-lg border p-4 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg]:size-4 [&>svg]:text-foreground [&>svg~*]:pl-6",
	{
		variants: {
			variant: {
				default: "bg-background text-foreground",
				primary:
					"border-primary/20 bg-primary/10 text-primary [&>svg]:text-primary",
				error: "border-destructive/20 bg-destructive/10 text-destructive [&>svg]:text-destructive",
				success:
					"border-success/20 bg-success/10 text-success [&>svg]:text-success",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

const Alert = ({
	className,
	variant,
	...props
}: React.HTMLAttributes<HTMLDivElement> &
	VariantProps<typeof alertVariants>) => (
	<div
		role="alert"
		className={cn(alertVariants({ variant }), className)}
		{...props}
	/>
);

const AlertTitle = ({
	className,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
	<h5
		className={cn(
			"font-semibold text-sm leading-tight tracking-tight",
			className,
		)}
		{...props}
	/>
);

const AlertDescription = ({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
	<div
		className={cn("text-sm [&_p]:leading-relaxed mt-1", className)}
		{...props}
	/>
);

export { Alert, AlertDescription, AlertTitle };
