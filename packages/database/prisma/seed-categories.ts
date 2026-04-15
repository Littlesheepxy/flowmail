import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const DEFAULT_CATEGORIES = [
	{
		slug: "approval",
		name: "审批",
		icon: "ShieldCheckIcon",
		color: "#f59e0b",
		sortOrder: 0,
		aiPrompt:
			"包含审批请求、授权需求的邮件，如：请审批、需要审核、approve、authorization、请批准、需要您的同意",
	},
	{
		slug: "report",
		name: "汇报",
		icon: "FileTextIcon",
		color: "#3b82f6",
		sortOrder: 1,
		aiPrompt:
			"进度更新、周报、日报、状态汇报类邮件，如：weekly report、工作总结、进展汇报、月度报告、数据报表",
	},
	{
		slug: "issue",
		name: "问题",
		icon: "AlertTriangleIcon",
		color: "#ef4444",
		sortOrder: 2,
		aiPrompt:
			"问题报告、Bug、故障、投诉类邮件，如：bug report、系统异常、紧急问题、故障通知、用户投诉",
	},
	{
		slug: "feedback",
		name: "反馈",
		icon: "MessageSquareIcon",
		color: "#10b981",
		sortOrder: 3,
		aiPrompt:
			"建议、反馈、评价类邮件，如：用户反馈、产品建议、improvement、feature request、满意度调查",
	},
	{
		slug: "noise",
		name: "已过滤",
		icon: "FilterIcon",
		color: "#94a3b8",
		sortOrder: 10,
		aiPrompt:
			"营销推广、订阅通知、自动生成的系统邮件、广告、新闻简报、促销活动、邮件列表群发等非业务性邮件",
	},
];

async function main() {
	const organizations = await db.organization.findMany({
		select: { id: true, name: true },
	});

	console.log(`Found ${organizations.length} organization(s)`);

	for (const org of organizations) {
		console.log(`Seeding categories for: ${org.name} (${org.id})`);

		for (const cat of DEFAULT_CATEGORIES) {
			await db.category.upsert({
				where: {
					organizationId_slug: {
						organizationId: org.id,
						slug: cat.slug,
					},
				},
				create: {
					organizationId: org.id,
					...cat,
					isDefault: true,
				},
				update: {},
			});
		}

		const TYPE_TO_SLUG: Record<string, string> = {
			APPROVAL: "approval",
			REPORT: "report",
			ISSUE: "issue",
			FEEDBACK: "feedback",
			NOISE: "noise",
		};

		const categories = await db.category.findMany({
			where: { organizationId: org.id },
			select: { id: true, slug: true },
		});

		const slugToId = Object.fromEntries(
			categories.map((c) => [c.slug, c.id]),
		);

		const entities = await db.flowEntity.findMany({
			where: { organizationId: org.id, categoryId: null },
			select: { id: true, type: true },
		});

		for (const entity of entities) {
			const slug = TYPE_TO_SLUG[entity.type];
			const categoryId = slug ? slugToId[slug] : undefined;
			if (categoryId) {
				await db.flowEntity.update({
					where: { id: entity.id },
					data: { categoryId },
				});
			}
		}

		console.log(
			`  Created ${DEFAULT_CATEGORIES.length} categories, backfilled ${entities.length} entities`,
		);
	}

	console.log("Done!");
}

main()
	.catch((e) => {
		console.error("Failed:", e);
		process.exit(1);
	})
	.finally(() => db.$disconnect());
