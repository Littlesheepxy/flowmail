import { config } from "@repo/config";
import { createI18nSearchAPI } from "fumadocs-core/search/server";
import { docsSource } from "../../docs-source";

export const { GET } = createI18nSearchAPI("advanced", {
	i18n: {
		defaultLanguage: config.i18n.defaultLocale,
		languages: Object.keys(config.i18n.locales),
	},
	indexes: docsSource.getLanguages().flatMap((entry) =>
		entry.pages.map((page) => ({
			title: page.data.title,
			description: page.data.description,
			structuredData: page.data.structuredData,
			id: page.url,
			url: page.url,
			locale: entry.language,
		})),
	),
});
