import { config } from "@repo/config";
import { useLocale } from "next-intl";

export function useLocaleCurrency() {
	const locale = useLocale();
	const localeCurrency =
		Object.entries(config.i18n.locales).find(([key]) => key === locale)?.[1]
			.currency ?? config.i18n.defaultCurrency;

	return localeCurrency;
}
