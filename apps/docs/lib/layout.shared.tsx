import { defineI18nUI } from "fumadocs-ui/i18n";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { i18n } from "@/lib/i18n";

export const i18nUI = defineI18nUI(i18n, {
	translations: {
		en: {
			displayName: "English",
		},
		zh: {
			displayName: "中文",
			search: "搜索文档",
			toc: "目录",
			lastUpdate: "最后更新",
			searchNoResult: "未找到结果",
			previousPage: "上一页",
			nextPage: "下一页",
		},
	},
});

export function baseOptions(locale: string): BaseLayoutProps {
	if (locale === "zh") {
		return {
			nav: { title: "Flowmail 文档" },
		};
	}
	return {
		nav: { title: "Flowmail Docs" },
	};
}
