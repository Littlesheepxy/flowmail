import { db } from "@repo/database";

/**
 * Get categories for an organization. Does NOT auto-create defaults.
 * Returns empty array if the org has no categories — callers must handle
 * the "no categories yet" state by prompting the user to create their own.
 */
export async function getOrgCategories(
	organizationId: string,
): Promise<
	Array<{ id: string; name: string; slug: string; aiPrompt: string }>
> {
	return db.category.findMany({
		where: { organizationId },
		select: { id: true, name: true, slug: true, aiPrompt: true },
		orderBy: { sortOrder: "asc" },
	});
}

/** @deprecated Use getOrgCategories. Kept for one release for callers that haven't migrated. */
export const ensureDefaultCategories = getOrgCategories;

/** Sample categories shown in the empty-state UI. NOT auto-inserted. */
export const SAMPLE_CATEGORIES: ReadonlyArray<{
	name: string;
	slug: string;
	icon: string;
	color: string;
	aiPrompt: string;
	description: string;
}> = [
	{
		name: "子公司月报",
		slug: "subsidiary-report",
		icon: "BuildingIcon",
		color: "#10b981",
		description: "各子公司发来的月度/季度经营汇报、KPI 数据、项目进展",
		aiPrompt:
			"Monthly/quarterly business reports from subsidiaries or portfolio companies. Includes KPI data, financial summaries, project progress, headcount changes. Usually has attachments (PDF/Excel) with detailed numbers.",
	},
	{
		name: "投资项目跟进",
		slug: "investment-followup",
		icon: "TrendingUpIcon",
		color: "#6366f1",
		description: "已投/在投项目的进展、估值、轮次更新、退出讨论",
		aiPrompt:
			"Updates from portfolio companies or investment targets: round updates, valuation changes, milestone hits, exit discussions, follow-on rounds, board updates.",
	},
	{
		name: "合同/审批",
		slug: "contract-approval",
		icon: "FileSignatureIcon",
		color: "#f59e0b",
		description: "需要签字、批准、走流程的合同、协议、采购单",
		aiPrompt:
			"Anything requesting your signature, approval, or sign-off: contracts, agreements, purchase orders, expense approvals, NDA, term sheets pending review.",
	},
	{
		name: "客户对接",
		slug: "client-comms",
		icon: "MessageSquareIcon",
		color: "#0ea5e9",
		description: "客户/LP/合作方主动发来的咨询、需求、反馈",
		aiPrompt:
			"Inbound communications from clients, LPs, partners, or external stakeholders: questions, requests, feedback, meeting requests, intros.",
	},
	{
		name: "内部通知",
		slug: "internal-notice",
		icon: "BellIcon",
		color: "#94a3b8",
		description: "团队内部公告、HR、IT、行政通知",
		aiPrompt:
			"Internal team announcements, HR/IT/admin notifications, all-hands invites, policy updates. Usually FYI-only, no action required.",
	},
] as const;
