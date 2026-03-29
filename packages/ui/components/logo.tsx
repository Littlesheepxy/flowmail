import { cn } from "../lib";

export function Logo({
	withLabel = true,
	className,
}: {
	className?: string;
	withLabel?: boolean;
}) {
	return (
		<span
			className={cn(
				"flex items-center font-semibold text-foreground leading-none",
				className,
			)}
		>
			<img
				src="/logo.png"
				alt="Flowmail"
			width={withLabel ? 44 : 32}
			height={withLabel ? 44 : 32}
				className="shrink-0 dark:invert"
			/>
		{withLabel && (
			<span className="ml-2.5 text-base tracking-tight font-semibold transition-opacity duration-200">
				Flowmail
			</span>
		)}
		</span>
	);
}
