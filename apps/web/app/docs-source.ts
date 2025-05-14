import { createMDXSource } from "@fumadocs/content-collections";
import { config } from "@repo/config";
import { allDocs, allDocsMetas } from "content-collections";
import { loader } from "fumadocs-core/source";
import { Home } from "lucide-react";
import { createElement } from "react";

export const docsSource = loader({
	baseUrl: "/docs",
	i18n: {
		defaultLanguage: config.i18n.defaultLocale,
		languages: Object.keys(config.i18n.locales),
	},
	source: createMDXSource(allDocs, allDocsMetas),
	icon(icon) {
		if (!icon) {
			return;
		}

		const icons = {
			Home,
		};

		if (icon in icons) {
			return createElement(icons[icon as keyof typeof icons]);
		}
	},
});
