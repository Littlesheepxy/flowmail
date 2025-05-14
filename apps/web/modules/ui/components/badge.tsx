import { cn } from "@ui/lib";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type React from "react";

export const badge = cva(
	[
		"inline-block",
		"rounded-full",
		"px-3",
		"py-1",
		"text-xs",
		"uppercase",
		"font-semibold",
		"leading-tight",
	],
	{
		variants: {
			status: {
				success: ["bg-emerald-500/10", "text-emerald-500"],
				info: ["bg-primary/10", "text-primary"],
				warning: ["bg-amber-500/10", "text-amber-500"],
				error: ["bg-rose-500/10", "text-rose-500"],
			},
		},
		defaultVariants: {
			status: "info",
		},
	},
);

export type BadgeProps = React.HtmlHTMLAttributes<HTMLDivElement> &
	VariantProps<typeof badge>;

export const Badge = ({
	children,
	className,
	status,
	...props
}: BadgeProps) => (
	<span className={cn(badge({ status }), className)} {...props}>
		{children}
	</span>
);

Badge.displayName = "Badge";
