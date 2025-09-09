"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@ui/lib";
import * as React from "react";

const Avatar = ({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) => (
	<AvatarPrimitive.Root
		className={cn(
			"relative flex h-8 w-8 shrink-0 overflow-hidden rounded-sm",
			className,
		)}
		{...props}
	/>
);

const AvatarImage = ({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) => (
	<AvatarPrimitive.Image
		className={cn("aspect-square h-full w-full rounded-sm", className)}
		{...props}
	/>
);

const AvatarFallback = ({
	className,
	...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) => (
	<AvatarPrimitive.Fallback
		className={cn(
			"flex h-full w-full items-center justify-center rounded-sm bg-muted font-bold text-xs",
			className,
		)}
		{...props}
	/>
);

export { Avatar, AvatarFallback, AvatarImage };
