export const config = {
	// Define all locales here that should be available in the app
	// You need to define a label that is shown in the language selector and a currency that should be used for pricing with this locale
	locales: {
		en: {
			label: "English",
			currency: "USD",
		},
		de: {
			label: "Deutsch",
			currency: "USD",
		},
	},
	// The default locale is used if no locale is provided
	defaultLocale: "en",
	// The default currency is used for pricing if no currency is provided
	defaultCurrency: "USD",
	// The name of the cookie that is used to determine the locale
	localeCookieName: "NEXT_LOCALE",
} as const;
