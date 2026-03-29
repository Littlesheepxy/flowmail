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
						date: "2026-03-29",
						title: "Flowmail Launch",
						changes: [
							"AI-powered email classification (approvals, reports, issues)",
							"Structured approval dashboard with one-click actions",
							"Report extraction: progress, blockers, owners, next steps",
							"MCP server for agent integration (Claude, Cursor, OpenClaw)",
						],
					},
					{
						date: "2026-03-20",
						title: "Email Processing Pipeline",
						changes: [
							"Automatic email triage and categorization",
							"Confidence-scored classification with AI models",
							"Gmail OAuth integration for secure email access",
						],
					},
					{
						date: "2026-03-10",
						title: "Foundation",
						changes: [
							"Core platform architecture and database schema",
							"Organization-based multi-tenant setup",
							"Dual API layer: oRPC (frontend) + MCP (agents)",
						],
					},
				]}
			/>
		</div>
	);
}
