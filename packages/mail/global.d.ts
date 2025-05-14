import type { Messages } from "@repo/i18n/types";

declare global {
	interface IntlMessages extends Messages {}
}
