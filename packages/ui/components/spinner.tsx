import { Loader2Icon } from "lucide-react";
import { cn } from "../lib";

export function Spinner({ className }: { className?: string }) {
	return (
		<Loader2Icon
			className={cn("size-4 animate-spin text-primary", className)}
		/>
	);
}
