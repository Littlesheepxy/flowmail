import { fastModel, safeGenerateObject, zArray, zNonNegInt } from "@repo/ai";
import { z } from "zod";

const SAMPLE_ICONS = [
	"BuildingIcon",
	"TrendingUpIcon",
	"FileSignatureIcon",
	"MessageSquareIcon",
	"BellIcon",
	"BriefcaseIcon",
	"DollarSignIcon",
	"HandshakeIcon",
	"UsersIcon",
	"AlertCircleIcon",
	"BookOpenIcon",
	"PackageIcon",
] as const;

const SAMPLE_COLORS = [
	"#10b981",
	"#6366f1",
	"#f59e0b",
	"#0ea5e9",
	"#94a3b8",
	"#ef4444",
	"#a855f7",
	"#14b8a6",
] as const;

export const SuggestedCategorySchema = z.object({
	name: z.string().min(1).max(20),
	slug: z
		.string()
		.min(1)
		.max(40)
		.regex(/^[a-z0-9-]+$/),
	icon: z.enum(SAMPLE_ICONS),
	color: z.enum(SAMPLE_COLORS),
	description: z.string().min(5).max(80),
	aiPrompt: z.string().min(20).max(500),
	matchedExamples: zArray(z.string().transform((s) => s.slice(0, 120)), {
		max: 5,
		describe: "匹配示例（每条 <= 120 字）",
	}),
});

export const CategorySuggestionSchema = z.object({
	suggestions: zArray(SuggestedCategorySchema, {
		min: 2,
		max: 6,
		describe: "建议的新分类",
	}),
	reasoning: z.string().transform((s) => s.slice(0, 400)),
	uncoveredCount: zNonNegInt(),
});

export type SuggestedCategory = z.infer<typeof SuggestedCategorySchema>;
export type CategorySuggestion = z.infer<typeof CategorySuggestionSchema>;

export interface InboxSampleEmail {
	subject: string;
	sender: string;
	snippet: string;
}

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

export async function suggestCategoriesFromInbox(params: {
	emails: InboxSampleEmail[];
	existingCategoryNames?: string[];
	hint?: string;
}): Promise<CategorySuggestion> {
	const { emails, existingCategoryNames = [], hint } = params;

	if (emails.length === 0) {
		return { suggestions: [], reasoning: "收件箱为空", uncoveredCount: 0 };
	}

	const sample = emails
		.slice(0, 60)
		.map(
			(e, i) =>
				`${i + 1}. [${e.sender || "unknown"}] ${e.subject || "(no subject)"} — ${(e.snippet || "").slice(0, 120)}`,
		)
		.join("\n");

	const existingHint =
		existingCategoryNames.length > 0
			? `\n\nThe user already has these categories — DO NOT duplicate them, only suggest NEW ones that complement: ${existingCategoryNames.join(", ")}`
			: "";

	const userHint = hint ? `\n\nUser preference: ${hint}` : "";

	const prompt = `You are designing a personal email triage system for a senior decision-maker (likely an investor, executive, or fund partner based on the inbox).

Look at this real sample of their inbox and propose 3-6 CATEGORIES that match how THEY actually work — not generic enterprise categories like "approval / report / feedback / noise". Categories should reflect *what kind of decision or action* this email type triggers in their day.

Good examples:
  - 子公司月报 (subsidiary monthly reports)
  - 投资项目跟进 (portfolio updates)
  - 合同/审批 (contracts pending signature)
  - 客户对接 (inbound from clients/LPs)
  - 内部通知 (FYI internal)

Bad examples (too generic, do NOT use):
  - 工作邮件 / 通知 / 重要 / 一般

Categories MUST:
- Be in Chinese (or bilingual if natural)
- Each be distinct in *purpose*, not just topic
- Together cover ≥80% of the inbox sample
- Each have a concrete classifier prompt in English (300 chars max) that another AI can use to match new emails

Inbox sample (${emails.length} emails):
${sample}${existingHint}${userHint}

Return 3-6 suggestions plus a short reasoning. Set uncoveredCount to estimate how many sample emails wouldn't fit any of your suggestions.`;

	try {
		return await safeGenerateObject({
			model: fastModel,
			schema: CategorySuggestionSchema,
			prompt,
		});
	} catch (err) {
		console.warn(
			"[CategorySuggester] suggestion failed, returning empty",
			err instanceof Error ? err.message : String(err),
		);
		return {
			suggestions: [],
			reasoning: `AI 分析失败：${err instanceof Error ? err.message : "未知错误"}`,
			uncoveredCount: emails.length,
		};
	}
}
