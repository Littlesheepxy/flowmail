import { cn } from "../lib";

export function Logo({
	withLabel = true,
	className,
}: {
	className?: string;
	withLabel?: boolean;
}) {
	const size = withLabel ? 28 : 22;

	return (
		<span
			className={cn(
				"flex items-center font-semibold text-foreground leading-none",
				className,
			)}
		>
			<img
				src="/logo-dark.png"
				alt="Flowmail"
				width={size}
				height={size}
				className="shrink-0 block dark:hidden"
			/>
			<img
				src="/logo-light.png"
				alt="Flowmail"
				width={size}
				height={size}
				className="shrink-0 hidden dark:block"
			/>
			{withLabel && (
				<span className="ml-2 text-base tracking-tight font-semibold">
					Flowmail
				</span>
			)}
		</span>
	);
}
