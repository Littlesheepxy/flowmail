"use server";

import { setLocaleCookie } from "@i18n/lib/locale-cookie";
import type { Locale } from "@repo/i18n";
import { revalidatePath } from "next/cache";

export async function updateLocale(locale: Locale) {
	await setLocaleCookie(locale);
	revalidatePath("/");
}
