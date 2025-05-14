"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

export function TableOfContents({
	items,
}: {
	items: { slug: string; content: string; lvl: number }[];
}) {
	const t = useTranslations();
	const scrollToSection = (id: string) => {
		const scrollOffset = 80;
		const element = document.getElementById(id);
		if (element) {
			const elementPositionY =
				element.getBoundingClientRect().top +
				window.scrollY -
				scrollOffset;
			window.scrollTo({ top: elementPositionY, behavior: "smooth" });
			history.pushState({}, "", `#${id}`);
		}
	};

	useEffect(() => {
		if (location.hash) {
			scrollToSection(location.hash.substring(1));
		}
	}, []);

	return (
		<div className="w-full max-w-64 self-start rounded-lg border p-4">
			<h3 className="mb-2 font-semibold text-base">
				{t("common.tableOfContents.title")}
			</h3>
			<nav className="list-none space-y-2">
				{items.map((item) => (
					<a
						key={item.slug}
						href={`#${item.slug}`}
						className={`block text-sm ${`ml-${Math.max(0, item.lvl - 2) * 2}`}`}
						onClick={(e) => {
							e.preventDefault();
							scrollToSection(item.slug);
						}}
					>
						{item.content}
					</a>
				))}
			</nav>
		</div>
	);
}
