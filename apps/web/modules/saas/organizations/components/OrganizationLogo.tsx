"use client";

import { config } from "@repo/config";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/avatar";
import BoringAvatar from "boring-avatars";
import { useMemo } from "react";
import { useIsClient } from "usehooks-ts";

export const OrganizationLogo = ({
	name,
	logoUrl,
	className,
	ref,
}: React.ComponentProps<typeof Avatar> & {
	name: string;
	logoUrl?: string | null;
	className?: string;
}) => {
	const isClient = useIsClient();
	const avatarColors = useMemo(() => {
		if (typeof window === "undefined") {
			return [];
		}

		const styles = getComputedStyle(window.document.documentElement);
		return [
			styles.getPropertyValue("--color-primary"),
			styles.getPropertyValue("--color-accent"),
			styles.getPropertyValue("--color-highlight"),
		];
	}, []);

	const logoSrc = useMemo(
		() =>
			logoUrl
				? logoUrl.startsWith("http")
					? logoUrl
					: `/image-proxy/${config.storage.bucketNames.avatars}/${logoUrl}`
				: undefined,
		[logoUrl],
	);

	if (!isClient) {
		return null;
	}

	return (
		<Avatar ref={ref} className={className}>
			<AvatarImage src={logoSrc} />
			<AvatarFallback>
				<BoringAvatar
					size={96}
					name={name}
					variant="sunset"
					colors={avatarColors}
					square
				/>
			</AvatarFallback>
		</Avatar>
	);
};

OrganizationLogo.displayName = "OrganizationLogo";
