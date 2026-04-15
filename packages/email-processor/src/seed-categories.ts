import { db } from "@repo/database";

const DEFAULT_CATEGORIES = [
	{
		name: "审批",
		slug: "approval",
		icon: "ShieldCheckIcon",
		color: "#f59e0b",
		aiPrompt:
			"Contains approval requests, authorization needs, expense reports requiring sign-off, leave requests, purchase orders, or any email with phrases like '请审批', '需要批准', 'please approve', 'pending approval'.",
		sortOrder: 0,
	},
	{
		name: "汇报",
		slug: "report",
		icon: "TrendingUpIcon",
		color: "#10b981",
		aiPrompt:
			"Progress updates, weekly/daily/monthly reports, status summaries, milestone updates, project updates, or any email with phrases like '周报', '进展', 'weekly report', 'status update', 'progress'.",
		sortOrder: 1,
	},
	{
		name: "问题",
		slug: "issue",
		icon: "AlertCircleIcon",
		color: "#ef4444",
		aiPrompt:
			"Bug reports, incidents, complaints, problems requiring attention, escalations, blockers, or any email indicating something is broken, failing, or needs urgent fix.",
		sortOrder: 2,
	},
	{
		name: "反馈",
		slug: "feedback",
		icon: "MessageSquareIcon",
		color: "#6366f1",
		aiPrompt:
			"General suggestions, feedback, reviews, opinions, feature requests, or any email that provides input but does not require immediate action or approval.",
		sortOrder: 3,
	},
	{
		name: "已过滤",
		slug: "noise",
		icon: "FilterIcon",
		color: "#94a3b8",
		aiPrompt:
			"Marketing emails, subscription notifications, automated system notifications, ads, newsletters, promotional content, verification codes, social media alerts, non-business emails (营销推广、订阅通知、自动系统邮件、广告、新闻简报、验证码).",
		sortOrder: 4,
	},
] as const;

/**
 * Ensure default categories exist for an organization.
 * If the org has zero categories, creates the 5 defaults.
 * Returns the full category list (either existing or newly created).
 */
export async function ensureDefaultCategories(
	organizationId: string,
): Promise<
	Array<{ id: string; name: string; slug: string; aiPrompt: string }>
> {
	const existing = await db.category.findMany({
		where: { organizationId },
		select: { id: true, name: true, slug: true, aiPrompt: true },
		orderBy: { sortOrder: "asc" },
	});

	if (existing.length > 0) {
		return existing;
	}

	console.info(
		`[SeedCategories] Creating default categories for org=${organizationId}`,
	);

	const created: Array<{
		id: string;
		name: string;
		slug: string;
		aiPrompt: string;
	}> = [];

	for (const cat of DEFAULT_CATEGORIES) {
		const record = await db.category.create({
			data: {
				organizationId,
				name: cat.name,
				slug: cat.slug,
				icon: cat.icon,
				color: cat.color,
				aiPrompt: cat.aiPrompt,
				sortOrder: cat.sortOrder,
				isDefault: true,
			},
			select: { id: true, name: true, slug: true, aiPrompt: true },
		});
		created.push(record);
	}

	console.info(
		`[SeedCategories] Created ${created.length} default categories for org=${organizationId}`,
	);

	return created;
}
