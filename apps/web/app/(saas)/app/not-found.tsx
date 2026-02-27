import { Button } from "@repo/ui/components/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppWrapper } from "@/modules/saas/shared/components/AppWrapper";

export default async function NotFoundPage() {
	const t = await getTranslations();

	return (
		<AppWrapper>
			<div className="flex h-full flex-col items-center justify-center">
				<h1 className="font-bold text-5xl">{t("notFound.code")}</h1>
				<p className="mt-2 text-2xl">{t("notFound.title")}</p>

				<Button asChild className="mt-4">
					<Link href="/app">
						<ArrowLeftIcon className="mr-2 size-4" />{" "}
						{t("notFound.goToDashboard")}
					</Link>
				</Button>
			</div>
		</AppWrapper>
	);
}
