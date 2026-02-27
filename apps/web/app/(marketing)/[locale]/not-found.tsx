import { Button } from "@repo/ui";
import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LocaleLink } from "@/modules/i18n/routing";

export default async function NotFoundPage() {
	const t = await getTranslations();

	return (
		<div className="flex h-full flex-col items-center justify-center">
			<h1 className="font-bold text-5xl">{t("notFound.code")}</h1>
			<p className="mt-2 text-2xl">{t("notFound.title")}</p>

			<Button asChild className="mt-4">
				<LocaleLink href="/app">
					<ArrowLeftIcon className="mr-2 size-4" />{" "}
					{t("notFound.goToHomepage")}
				</LocaleLink>
			</Button>
		</div>
	);
}
