import { config } from "@repo/i18n/config";
import { useLocale } from "next-intl";

export function useLocaleCurrency() {
	const locale = useLocale();
	const localeCurrency =
		Object.entries(config.locales).find(([key]) => key === locale)?.[1]
			.currency ?? config.defaultCurrency;

	return localeCurrency;
}
