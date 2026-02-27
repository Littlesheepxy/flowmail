import { ChangelogSection } from "@marketing/changelog/components/ChangelogSection";
import { getTranslations } from "next-intl/server";

export default async function PricingPage() {
	const t = await getTranslations();

	return (
		<div className="container max-w-3xl pt-24 pb-16">
			<div className="mb-12 text-balance pt-8 text-center">
				<h1 className="mb-2 font-bold text-5xl">
					{t("changelog.title")}
				</h1>
				<p className="text-lg opacity-50">
					{t("changelog.description")}
				</p>
			</div>
			<ChangelogSection
				items={[
					{
						date: "2026-01-30",
						title: "Performance Improvements",
						changes: ["🚀 Improved performance"],
					},
					{
						date: "2026-01-26",
						title: "Design Updates",
						changes: ["🎨 Updated design", "🐞 Fixed a bug"],
					},
					{
						date: "2026-01-12",
						title: "New Features",
						changes: ["🎉 Added new feature", "🐞 Fixed a bug"],
					},
				]}
			/>
		</div>
	);
}
