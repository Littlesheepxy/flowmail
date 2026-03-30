/**
 * Flowmail 虚拟数据种子脚本
 *
 * 生成：
 * - 1 个测试用户 + 组织
 * - 2 个邮箱连接
 * - 4 个 FlowEntity（审批×2 + 汇报×1 + 问题×1）
 * - 每个 Entity 附带丰富的 Timeline（4–8 个节点）
 * - 关联 EmailThread
 *
 * 运行：pnpm --filter @repo/database exec ts-node prisma/seed-flowmail.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// ── 工具函数 ──────────────────────────────────────────────

function daysAgo(n: number, offsetHours = 0): Date {
	const d = new Date();
	d.setDate(d.getDate() - n);
	d.setHours(d.getHours() - offsetHours);
	return d;
}

function daysFromNow(n: number): Date {
	const d = new Date();
	d.setDate(d.getDate() + n);
	return d;
}

// ── 主逻辑 ────────────────────────────────────────────────

async function main() {
	console.log("🌱 Flowmail seed starting...\n");

	// 1. 找到第一个组织
	const org = await db.organization.findFirst({ include: { members: { include: { user: true } } } });
	if (!org) {
		console.error("❌ No organization found. Please sign up and create an organization first.");
		process.exit(1);
	}

	const user = org.members[0]?.user;
	if (!user) {
		console.error("❌ No user found in organization.");
		process.exit(1);
	}

	console.log(`✅ Using org: ${org.name} (${org.id})`);
	console.log(`✅ Using user: ${user.name} (${user.id})\n`);

	// 2. 清理旧数据（幂等）
	await db.timelineEvent.deleteMany({ where: { entity: { organizationId: org.id } } });
	await db.emailAttachment.deleteMany({ where: { thread: { organizationId: org.id } } });
	await db.emailThread.deleteMany({ where: { organizationId: org.id } });
	await db.flowEntity.deleteMany({ where: { organizationId: org.id } });
	await db.emailConnection.deleteMany({ where: { organizationId: org.id } });
	await db.category.deleteMany({ where: { organizationId: org.id } });
	console.log("🗑️  Cleared old seed data\n");

	// 3. 创建分类
	const categories = await Promise.all([
		db.category.create({
			data: {
				organizationId: org.id,
				name: "审批",
				slug: "approval",
				icon: "CheckSquareIcon",
				color: "#6366f1",
				aiPrompt: "邮件中包含审批请求、授权需要，如'请审批'、'approval request'等",
				sortOrder: 0,
				isDefault: true,
			},
		}),
		db.category.create({
			data: {
				organizationId: org.id,
				name: "汇报跟踪",
				slug: "report",
				icon: "BarChart2Icon",
				color: "#10b981",
				aiPrompt: "周报、进展更新、状态汇报类邮件",
				sortOrder: 1,
			},
		}),
		db.category.create({
			data: {
				organizationId: org.id,
				name: "问题反馈",
				slug: "issue",
				icon: "AlertTriangleIcon",
				color: "#f59e0b",
				aiPrompt: "故障、问题、Bug、投诉类邮件",
				sortOrder: 2,
			},
		}),
	]);

	const [approvalCat, reportCat, issueCat] = categories;
	console.log(`✅ Created ${categories.length} categories\n`);

	// 4. 创建邮箱连接
	const connection = await db.emailConnection.create({
		data: {
			organizationId: org.id,
			provider: "gmail",
			authType: "oauth2",
			email: "demo@flowmail.ai",
			isActive: true,
			lastSyncAt: daysAgo(0),
		},
	});
	console.log("✅ Created email connection\n");

	// ════════════════════════════════════════════════════════
	// Entity 1：Q1 营销预算审批（已完成-批准）
	// ════════════════════════════════════════════════════════
	const e1 = await db.flowEntity.create({
		data: {
			organizationId: org.id,
			type: "APPROVAL",
			categoryId: approvalCat.id,
			title: "Q1 营销预算审批申请 ¥200,000",
			status: "approved",
			aiConfidence: 0.95,
			requiresReview: false,
			extractedFields: JSON.stringify({
				applicant: "张明（市场部）",
				amount: "¥200,000",
				purpose: "Q1 全渠道营销投放",
				deadline: daysAgo(2).toISOString().split("T")[0],
				department: "市场部",
				priority: "高",
			}),
			aiSummary: "市场部张明申请 Q1 营销预算 ¥200,000，用于全渠道广告投放，截止日期为本月底，优先级高。",
			createdAt: daysAgo(7),
			updatedAt: daysAgo(1),
		},
	});

	await db.emailThread.create({
		data: {
			organizationId: org.id,
			connectionId: connection.id,
			externalThreadId: "thread_001",
			subject: "[审批申请] Q1 营销预算 ¥200,000",
			sender: "zhangming@company.com",
			senderName: "张明",
			participants: JSON.stringify(["zhangming@company.com", "demo@flowmail.ai"]),
			snippet: "您好，我是市场部张明，现申请 Q1 全渠道营销预算 ¥200,000，请审批。",
			bodyText: `您好，

我是市场部张明，现正式申请 Q1 全渠道营销预算。

申请详情：
- 金额：¥200,000
- 用途：Q1 全渠道广告投放（社交媒体、搜索引擎、KOL）
- 截止日期：本月底
- 预期 ROI：300%

请领导审批，谢谢！

张明
市场部`,
			entityId: e1.id,
			receivedAt: daysAgo(7),
			processedAt: daysAgo(7),
		},
	});

	await db.timelineEvent.createMany({
		data: [
			{
				entityId: e1.id,
				type: "email_received",
				content: "收到张明（市场部）的审批申请邮件：Q1 营销预算 ¥200,000",
				metadata: JSON.stringify({ sender: "zhangming@company.com", subject: "[审批申请] Q1 营销预算 ¥200,000" }),
				createdAt: daysAgo(7),
			},
			{
				entityId: e1.id,
				type: "ai_summary",
				content: "AI 解析完成：审批请求，置信度 95%，提取到申请人、金额、用途、截止日期",
				metadata: JSON.stringify({
					confidence: 0.95,
					categorySlug: "approval",
					reasoning: "邮件包含明确的审批申请意图、金额和截止日期",
					extractedFields: {
						applicant: "张明（市场部）",
						amount: "¥200,000",
						purpose: "Q1 全渠道营销投放",
						deadline: daysAgo(2).toISOString().split("T")[0],
					},
				}),
				createdAt: daysAgo(7, -1),
			},
			{
				entityId: e1.id,
				type: "email_received",
				content: "收到张明的补充说明邮件：附上了 ROI 预测分析报告",
				metadata: JSON.stringify({ sender: "zhangming@company.com", subject: "Re: [审批申请] Q1 营销预算 - 补充材料" }),
				createdAt: daysAgo(5),
			},
			{
				entityId: e1.id,
				type: "note",
				content: "已与财务部确认，Q1 预算池还有 ¥250,000 余额，本次申请可覆盖",
				metadata: JSON.stringify({ source: "manual" }),
				actorId: user.id,
				createdAt: daysAgo(3),
			},
			{
				entityId: e1.id,
				type: "action_taken",
				content: "已批准：同意 Q1 营销预算 ¥200,000，要求每月提交 ROI 报告",
				metadata: JSON.stringify({ action: "approved", comment: "同意，请每月提交 ROI 报告" }),
				actorId: user.id,
				createdAt: daysAgo(1),
			},
			{
				entityId: e1.id,
				type: "status_changed",
				content: "状态变更：pending → approved",
				metadata: JSON.stringify({ previousStatus: "pending", newStatus: "approved" }),
				actorId: user.id,
				createdAt: daysAgo(1),
			},
		],
	});

	console.log(`✅ Entity 1: "${e1.title}" (approved)`);

	// ════════════════════════════════════════════════════════
	// Entity 2：服务器扩容审批（紧急，待审批，2天后截止）
	// ════════════════════════════════════════════════════════
	const e2 = await db.flowEntity.create({
		data: {
			organizationId: org.id,
			type: "APPROVAL",
			categoryId: approvalCat.id,
			title: "生产环境服务器扩容申请（紧急）",
			status: "pending",
			aiConfidence: 0.91,
			requiresReview: false,
			extractedFields: JSON.stringify({
				applicant: "李工（基础设施组）",
				resourceType: "AWS EC2 c5.4xlarge × 4",
				monthlyCost: "¥18,400/月",
				urgency: "紧急",
				reason: "近期流量激增 340%，当前服务器 CPU 持续高于 90%",
				deadline: daysFromNow(2).toISOString().split("T")[0],
			}),
			aiSummary: "基础设施组紧急申请扩容生产服务器，因流量激增导致 CPU 超载，需 2 天内批准，月增成本 ¥18,400。",
			createdAt: daysAgo(1),
			updatedAt: daysAgo(0),
		},
	});

	await db.emailThread.create({
		data: {
			organizationId: org.id,
			connectionId: connection.id,
			externalThreadId: "thread_002",
			subject: "【紧急】生产服务器扩容申请 - 需立即处理",
			sender: "ligong@company.com",
			senderName: "李工",
			participants: JSON.stringify(["ligong@company.com", "demo@flowmail.ai"]),
			snippet: "生产环境 CPU 持续 >90%，已影响用户体验，需紧急扩容 4 台 c5.4xlarge。",
			bodyText: `紧急！

生产环境 CPU 近 3 天持续超过 90%，昨日出现 3 次超时告警，已影响用户体验。

申请扩容：
- 机型：AWS EC2 c5.4xlarge × 4
- 月费用：¥18,400/月
- 原因：近期活跃用户增长 340%，当前容量不足
- 截止时间：${daysFromNow(2).toISOString().split("T")[0]}（再晚可能影响正式发布）

监控数据已附件，请尽快审批！

李工
基础设施组`,
			entityId: e2.id,
			receivedAt: daysAgo(1),
			processedAt: daysAgo(1),
		},
	});

	await db.timelineEvent.createMany({
		data: [
			{
				entityId: e2.id,
				type: "email_received",
				content: "收到李工（基础设施组）的紧急扩容申请",
				metadata: JSON.stringify({ sender: "ligong@company.com", subject: "【紧急】生产服务器扩容申请" }),
				createdAt: daysAgo(1),
			},
			{
				entityId: e2.id,
				type: "ai_summary",
				content: "AI 解析完成：紧急审批请求，检测到 urgency=高，截止日期为 2 天后",
				metadata: JSON.stringify({
					confidence: 0.91,
					categorySlug: "approval",
					reasoning: "邮件标题含【紧急】，内容有明确的申请、截止日期和费用",
					extractedFields: {
						urgency: "紧急",
						monthlyCost: "¥18,400/月",
						deadline: daysFromNow(2).toISOString().split("T")[0],
					},
				}),
				createdAt: daysAgo(1, -1),
			},
			{
				entityId: e2.id,
				type: "email_received",
				content: "李工追加：附上了近 7 天的 CPU/内存监控截图和容量预测报告",
				metadata: JSON.stringify({ sender: "ligong@company.com", subject: "Re: 【紧急】扩容申请 - 补充监控数据" }),
				createdAt: daysAgo(0, 4),
			},
		],
	});

	console.log(`✅ Entity 2: "${e2.title}" (pending, deadline in 2 days)`);

	// ════════════════════════════════════════════════════════
	// Entity 3：后端重构项目周报跟踪（进行中，有风险）
	// ════════════════════════════════════════════════════════
	const e3 = await db.flowEntity.create({
		data: {
			organizationId: org.id,
			type: "REPORT",
			categoryId: reportCat.id,
			title: "后端架构重构项目 - 进度跟踪",
			status: "in_progress",
			aiConfidence: 0.88,
			requiresReview: false,
			extractedFields: JSON.stringify({
				projectLead: "王芳（后端组）",
				overallProgress: "62%",
				plannedCompletion: daysFromNow(14).toISOString().split("T")[0],
				currentRisk: "中等",
				completedMilestones: "数据库迁移、API 重构",
				blockers: "第三方 SDK 兼容性问题待解决",
				weeklyVelocity: "下降 15%（本周）",
			}),
			aiSummary: "后端重构项目整体进度 62%，本周速度下降 15%，第三方 SDK 兼容性问题构成阻塞，预计交付时间有延期风险。",
			createdAt: daysAgo(28),
			updatedAt: daysAgo(1),
		},
	});

	// 4 封周报邮件
	const reportThreads = [
		{
			id: "thread_003a",
			subject: "【周报 #1】后端重构项目进展 - 第1周",
			snippet: "本周完成数据库 schema 迁移，测试通过率 98%，进度正常。",
			body: "本周完成：\n✅ 数据库 schema 迁移完成，测试通过率 98%\n✅ 制定 API 重构方案\n\n下周计划：\n- 开始 API 层重构\n- 搭建 CI/CD 管道\n\n风险：无\n整体进度：20%",
			receivedAt: daysAgo(28),
			timelineContent: "收到第 1 周周报：数据库迁移完成，进度 20%，无风险",
		},
		{
			id: "thread_003b",
			subject: "【周报 #2】后端重构项目进展 - 第2周",
			snippet: "API 重构进行中，遇到一个第三方 SDK 兼容性问题，已在排查。",
			body: "本周完成：\n✅ 核心 API 接口重构完成 60%\n✅ CI/CD 管道搭建完毕\n\n本周阻塞：\n⚠️ 第三方支付 SDK v2.x 与新架构不兼容，正在排查\n\n整体进度：42%",
			receivedAt: daysAgo(21),
			timelineContent: "收到第 2 周周报：进度 42%，首次出现 SDK 兼容性阻塞",
		},
		{
			id: "thread_003c",
			subject: "【周报 #3】后端重构项目进展 - 第3周（延期预警）",
			snippet: "SDK 问题仍未解决，影响速度。预计本周期无法完成 API 重构，存在延期风险。",
			body: "本周完成：\n✅ 完成 70% API 重构\n⚠️ SDK 兼容问题仍未解决，已联系第三方支持\n\n延期预警：\n❌ 按当前速度，预计延期 1-2 周\n\n整体进度：58%",
			receivedAt: daysAgo(14),
			timelineContent: "收到第 3 周周报：进度 58%，SDK 问题持续阻塞，首次出现延期预警",
		},
		{
			id: "thread_003d",
			subject: "【周报 #4】后端重构 - 第4周",
			snippet: "本周速度下降 15%，SDK 临时方案已实施，等待官方补丁。整体进度 62%。",
			body: "本周完成：\n✅ SDK 兼容问题临时解决方案已上线\n✅ 完成剩余 API 重构\n\n待处理：\n🔄 等待第三方 SDK 官方补丁（预计下周发布）\n\n整体进度：62%\n本周速度：较上周下降 15%",
			receivedAt: daysAgo(7),
			timelineContent: "收到第 4 周周报：进度 62%，速度下降 15%，临时方案运行中",
		},
	];

	for (const t of reportThreads) {
		await db.emailThread.create({
			data: {
				organizationId: org.id,
				connectionId: connection.id,
				externalThreadId: t.id,
				subject: t.subject,
				sender: "wangfang@company.com",
				senderName: "王芳",
				participants: JSON.stringify(["wangfang@company.com", "demo@flowmail.ai"]),
				snippet: t.snippet,
				bodyText: t.body,
				entityId: e3.id,
				receivedAt: t.receivedAt,
				processedAt: t.receivedAt,
			},
		});
	}

	await db.timelineEvent.createMany({
		data: [
			{
				entityId: e3.id,
				type: "email_received",
				content: reportThreads[0].timelineContent,
				metadata: JSON.stringify({ sender: "wangfang@company.com", subject: reportThreads[0].subject }),
				createdAt: daysAgo(28),
			},
			{
				entityId: e3.id,
				type: "ai_summary",
				content: "AI 解析：项目周报，整体进展正常，进度 20%，无风险",
				metadata: JSON.stringify({
					confidence: 0.88,
					categorySlug: "report",
					extractedFields: { progress: "20%", risk: "无", completed: "数据库迁移" },
					progressDelta: 20,
				}),
				createdAt: daysAgo(28, -1),
			},
			{
				entityId: e3.id,
				type: "email_received",
				content: reportThreads[1].timelineContent,
				metadata: JSON.stringify({ sender: "wangfang@company.com", subject: reportThreads[1].subject }),
				createdAt: daysAgo(21),
			},
			{
				entityId: e3.id,
				type: "ai_summary",
				content: "AI 对比上周：进度 +22%（20%→42%），新增风险信号：SDK 兼容性阻塞",
				metadata: JSON.stringify({
					confidence: 0.88,
					categorySlug: "report",
					extractedFields: { progress: "42%", risk: "中", blocker: "SDK兼容性问题" },
					progressDelta: 22,
				}),
				createdAt: daysAgo(21, -1),
			},
			{
				entityId: e3.id,
				type: "email_received",
				content: reportThreads[2].timelineContent,
				metadata: JSON.stringify({ sender: "wangfang@company.com", subject: reportThreads[2].subject }),
				createdAt: daysAgo(14),
			},
			{
				entityId: e3.id,
				type: "ai_summary",
				content: "⚠️ AI 对比检测：进度仅 +16%（42%→58%），速度下降，延期风险首次出现",
				metadata: JSON.stringify({
					confidence: 0.88,
					categorySlug: "report",
					extractedFields: { progress: "58%", risk: "高", blocker: "SDK兼容性问题（第2周）" },
					progressDelta: 16,
					riskSignals: ["速度明显下降", "阻塞项持续超过1周", "延期预警出现"],
				}),
				createdAt: daysAgo(14, -1),
			},
			{
				entityId: e3.id,
				type: "note",
				content: "已与王芳确认：SDK 官方补丁预计下周三发布，届时速度会恢复正常",
				metadata: JSON.stringify({ source: "manual" }),
				actorId: user.id,
				createdAt: daysAgo(13),
			},
			{
				entityId: e3.id,
				type: "email_received",
				content: reportThreads[3].timelineContent,
				metadata: JSON.stringify({ sender: "wangfang@company.com", subject: reportThreads[3].subject }),
				createdAt: daysAgo(7),
			},
			{
				entityId: e3.id,
				type: "ai_summary",
				content: "AI 对比：进度 +4%（58%→62%），速度较历史均值下降 15%，临时方案已运行",
				metadata: JSON.stringify({
					confidence: 0.88,
					categorySlug: "report",
					extractedFields: { progress: "62%", risk: "中", velocity: "下降15%" },
					progressDelta: 4,
					riskSignals: ["本周进展偏慢"],
				}),
				createdAt: daysAgo(7, -1),
			},
			{
				entityId: e3.id,
				type: "milestone",
				content: "里程碑：临时兼容方案上线，解除硬阻塞",
				metadata: JSON.stringify({ milestone: "兼容方案上线" }),
				actorId: user.id,
				createdAt: daysAgo(6),
			},
		],
	});

	console.log(`✅ Entity 3: "${e3.title}" (in_progress, risk detected)`);

	// ════════════════════════════════════════════════════════
	// Entity 4：支付接口故障（问题，已解决）
	// ════════════════════════════════════════════════════════
	const e4 = await db.flowEntity.create({
		data: {
			organizationId: org.id,
			type: "ISSUE",
			categoryId: issueCat.id,
			title: "生产支付接口超时故障（已解决）",
			status: "completed",
			aiConfidence: 0.93,
			requiresReview: false,
			extractedFields: JSON.stringify({
				reporter: "陈磊（SRE）",
				severity: "P1",
				affectedSystem: "支付接口",
				symptom: "超时率 >40%，部分用户无法完成支付",
				rootCause: "数据库连接池耗尽",
				resolution: "扩大连接池上限 + 增加连接复用",
				duration: "约 47 分钟",
				resolvedAt: daysAgo(3).toISOString(),
			}),
			aiSummary: "P1 级生产故障：支付接口超时率超 40%，根因为数据库连接池耗尽，已于发现后 47 分钟内修复，影响已消除。",
			createdAt: daysAgo(4),
			updatedAt: daysAgo(3),
		},
	});

	await db.emailThread.create({
		data: {
			organizationId: org.id,
			connectionId: connection.id,
			externalThreadId: "thread_004a",
			subject: "[P1 告警] 生产支付接口超时率 >40%",
			sender: "chenlei@company.com",
			senderName: "陈磊",
			participants: JSON.stringify(["chenlei@company.com", "demo@flowmail.ai", "sre-team@company.com"]),
			snippet: "生产支付接口超时率突增至 43%，大量用户无法完成支付，需立即处理！",
			entityId: e4.id,
			receivedAt: daysAgo(4),
			processedAt: daysAgo(4),
		},
	});

	await db.emailThread.create({
		data: {
			organizationId: org.id,
			connectionId: connection.id,
			externalThreadId: "thread_004b",
			subject: "Re: [P1 告警] 支付接口 - 根因分析 & 已修复",
			sender: "chenlei@company.com",
			senderName: "陈磊",
			participants: JSON.stringify(["chenlei@company.com", "demo@flowmail.ai"]),
			snippet: "根因确认：数据库连接池耗尽。已扩大上限并修复，超时率恢复正常，故障持续约 47 分钟。",
			entityId: e4.id,
			receivedAt: daysAgo(3),
			processedAt: daysAgo(3),
		},
	});

	await db.timelineEvent.createMany({
		data: [
			{
				entityId: e4.id,
				type: "email_received",
				content: "收到陈磊（SRE）的 P1 告警：支付接口超时率 >40%",
				metadata: JSON.stringify({ sender: "chenlei@company.com", severity: "P1" }),
				createdAt: daysAgo(4),
			},
			{
				entityId: e4.id,
				type: "ai_summary",
				content: "AI 解析：P1 级故障报告，高紧迫性，影响范围：生产支付系统",
				metadata: JSON.stringify({
					confidence: 0.93,
					categorySlug: "issue",
					extractedFields: { severity: "P1", system: "支付接口", symptom: "超时率>40%" },
				}),
				createdAt: daysAgo(4, -1),
			},
			{
				entityId: e4.id,
				type: "note",
				content: "正在排查：数据库连接数监控异常，怀疑连接池泄漏",
				metadata: JSON.stringify({ source: "manual" }),
				actorId: user.id,
				createdAt: daysAgo(4, -2),
			},
			{
				entityId: e4.id,
				type: "milestone",
				content: "根因确认：数据库连接池耗尽（maxPoolSize=20 配置过低）",
				metadata: JSON.stringify({ milestone: "根因确认" }),
				actorId: user.id,
				createdAt: daysAgo(4, -3),
			},
			{
				entityId: e4.id,
				type: "action_taken",
				content: "修复操作：maxPoolSize 从 20 调整至 100，启用连接复用，重启服务",
				metadata: JSON.stringify({ action: "fix_deployed" }),
				actorId: user.id,
				createdAt: daysAgo(4, -4),
			},
			{
				entityId: e4.id,
				type: "email_received",
				content: "收到陈磊的修复确认邮件：超时率恢复正常，故障历时约 47 分钟",
				metadata: JSON.stringify({ sender: "chenlei@company.com", subject: "Re: [P1] 支付接口 - 已修复" }),
				createdAt: daysAgo(3),
			},
			{
				entityId: e4.id,
				type: "status_changed",
				content: "状态变更：open → completed（故障已解决）",
				metadata: JSON.stringify({ previousStatus: "open", newStatus: "completed" }),
				actorId: user.id,
				createdAt: daysAgo(3),
			},
		],
	});

	console.log(`✅ Entity 4: "${e4.title}" (completed)\n`);

	// ── 汇总 ─────────────────────────────────────────────────
	const entityCount = await db.flowEntity.count({ where: { organizationId: org.id } });
	const threadCount = await db.emailThread.count({ where: { organizationId: org.id } });
	const eventCount = await db.timelineEvent.count({ where: { entity: { organizationId: org.id } } });

	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log(`✅ Seed complete!`);
	console.log(`   FlowEntity:    ${entityCount}`);
	console.log(`   EmailThread:   ${threadCount}`);
	console.log(`   TimelineEvent: ${eventCount}`);
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("\n访问路径：");
	console.log(`  /[org-slug]/inbox`);
	console.log(`  /[org-slug]/approvals`);
	console.log(`  /[org-slug]/reports`);
}

main()
	.catch((e) => {
		console.error("❌ Seed failed:", e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
