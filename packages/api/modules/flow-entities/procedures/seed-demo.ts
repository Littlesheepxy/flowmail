import { db } from "@repo/database";
import { z } from "zod";
import { requireOrgMembership } from "../../../lib/require-org-membership";
import { protectedProcedure } from "../../../orpc/procedures";

const DEMO_MARKER = "_isDemo";
const DEMO_CONNECTION_EMAIL = "demo@flowmail.work";

const seedDemoSchema = z.object({
	organizationId: z.string(),
	scenes: z
		.array(z.enum(["approval", "report", "issue"]))
		.min(1)
		.max(3),
});

interface DemoThread {
	subject: string;
	sender: string;
	senderName: string;
	toRecipients: string;
	bodyHtml: string;
	bodyText: string;
	snippet: string;
	receivedAtOffset: number;
}

interface DemoTimelineEvent {
	type: string;
	content: string;
	metadata?: Record<string, unknown>;
	offsetMinutes: number;
}

interface DemoEntity {
	type: "APPROVAL" | "REPORT" | "ISSUE" | "FEEDBACK";
	categorySlug: string;
	title: string;
	status: string;
	aiSummary: string;
	extractedFields: Record<string, unknown>;
	threads: DemoThread[];
	timeline: DemoTimelineEvent[];
}

function h(body: string): string {
	return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.7;color:#1a1a1a;max-width:600px">${body}</div>`;
}

const r = (names: Array<{ name: string; address: string }>) =>
	JSON.stringify(names);

// ════════════════════════════════════════════════════════════
// APPROVAL: Q3 市场推广预算（3 封邮件，完整审批流）
// ════════════════════════════════════════════════════════════
const approvalBudget: DemoEntity = {
	type: "APPROVAL",
	categorySlug: "approval",
	title: "Q3 市场推广预算审批 - ¥150,000",
	status: "pending",
	aiSummary:
		"市场部李明提交 Q3 推广预算 ¥150,000（线上广告 + 展会）。财务部赵丽要求补充 ROI 明细，李明已补充。当前待最终审批。",
	extractedFields: {
		[DEMO_MARKER]: true,
		applicant: "李明",
		department: "市场部",
		amount: "¥150,000",
		deadline: new Date(Date.now() + 3 * 86400000)
			.toISOString()
			.split("T")[0],
		category: "预算申请",
		urgency: "medium",
		nextActions: ["审核 ROI 数据后批准预算", "通知财务部预留资金"],
		blockers: ["需确认 Q2 渠道投放效果数据"],
		inProgressItems: ["李明补充各渠道 ROI 明细"],
	},
	threads: [
		{
			subject: "【审批】Q3 市场推广预算申请 - ¥150,000",
			sender: "liming@company.com",
			senderName: "李明",
			toRecipients: r([
				{ name: "张总", address: "zhangs@company.com" },
				{ name: "赵丽", address: "zhaoli@company.com" },
			]),
			snippet: "张总、赵丽好，附件是 Q3 市场推广预算申请，请审批。",
			bodyText:
				"张总、赵丽好，\n\n附件是 Q3 市场推广预算申请，总金额 ¥150,000。\n\n1. 线上广告投放：¥80,000\n2. 行业展会参展：¥50,000\n3. 品牌物料制作：¥20,000\n\n请在本周五前完成审批。\n\n李明 | 市场部",
			bodyHtml: h(`
				<p>张总、赵丽好，</p>
				<p>附件是 Q3 市场推广预算申请，总金额 <strong>¥150,000</strong>，明细如下：</p>
				<table style="border-collapse:collapse;width:100%;margin:12px 0">
					<tr style="background:#f8f9fa"><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">项目</td><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;text-align:right">金额</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">线上广告投放（抖音、小红书信息流）</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥80,000</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">行业展会参展（GMIC 2024）</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥50,000</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">品牌物料制作</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥20,000</td></tr>
					<tr style="background:#f8f9fa;font-weight:700"><td style="padding:8px 12px;border:1px solid #e5e7eb">合计</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥150,000</td></tr>
				</table>
				<p>请在本周五前完成审批，以便启动投放排期。</p>
				<p style="color:#6b7280">李明 | 市场部</p>
			`),
			receivedAtOffset: -4320,
		},
		{
			subject: "Re: 【审批】Q3 市场推广预算申请 - 需补充 ROI 明细",
			sender: "zhaoli@company.com",
			senderName: "赵丽",
			toRecipients: r([
				{ name: "李明", address: "liming@company.com" },
				{ name: "张总", address: "zhangs@company.com" },
			]),
			snippet: "李明，预算整体可以，但需要补充各渠道的 ROI 预估。",
			bodyText:
				"李明，\n\n预算整体结构没问题，但请补充以下信息：\n1. 各渠道的预估 ROI 和获客成本\n2. 与 Q2 同期投放效果对比\n3. 展会的预期线索数量\n\n补充后我这边可以签字。\n\n赵丽 | 财务部",
			bodyHtml: h(`
				<p>李明，</p>
				<p>预算整体结构没问题，但请补充以下信息后再审批：</p>
				<ol style="margin:8px 0;padding-left:20px;color:#4b5563">
					<li>各渠道的<strong>预估 ROI</strong> 和<strong>获客成本</strong></li>
					<li>与 Q2 同期投放效果对比</li>
					<li>展会的预期线索数量</li>
				</ol>
				<p>补充后我这边可以签字。</p>
				<p style="color:#6b7280">赵丽 | 财务部</p>
			`),
			receivedAtOffset: -2880,
		},
		{
			subject: "Re: 【审批】Q3 市场推广预算申请 - ROI 明细已补充",
			sender: "liming@company.com",
			senderName: "李明",
			toRecipients: r([
				{ name: "赵丽", address: "zhaoli@company.com" },
				{ name: "张总", address: "zhangs@company.com" },
			]),
			snippet: "赵丽，ROI 明细已补充，请查收。",
			bodyText:
				"赵丽，\n\nROI 明细已补充：\n\n- 抖音信息流：预计 ROI 1:4.5，获客成本 ¥180/条\n- 小红书：预计 ROI 1:3.2，获客成本 ¥250/条\n- 展会：预计获取线索 200+，获客成本 ¥250/条\n- Q2 同期对比：整体获客成本下降 15%\n\n综合获客成本控制在 ¥220/条以内。\n\n李明 | 市场部",
			bodyHtml: h(`
				<p>赵丽，</p>
				<p>ROI 明细已补充：</p>
				<table style="border-collapse:collapse;width:100%;margin:12px 0">
					<tr style="background:#f8f9fa"><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">渠道</td><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;text-align:right">预计 ROI</td><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;text-align:right">获客成本</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">抖音信息流</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">1:4.5</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥180/条</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">小红书</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">1:3.2</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥250/条</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">展会线索</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">—</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥250/条</td></tr>
				</table>
				<p style="background:#f0fdf4;padding:8px 12px;border-radius:6px;color:#166534">📊 Q2 同期对比：整体获客成本<strong>下降 15%</strong>，综合控制在 ¥220/条以内</p>
				<p style="color:#6b7280;margin-top:12px">李明 | 市场部</p>
			`),
			receivedAtOffset: -1440,
		},
	],
	timeline: [
		{
			type: "email_received",
			content: "收到李明（市场部）的审批请求邮件",
			metadata: { from: "liming@company.com" },
			offsetMinutes: -4320,
		},
		{
			type: "ai_summary",
			content:
				"AI 识别为预算审批。申请人李明，金额 ¥150,000，含线上广告和展会。截止本周五。",
			metadata: {
				confidence: 0.95,
				categorySlug: "approval",
				extractedFields: {
					applicant: "李明",
					department: "市场部",
					amount: "¥150,000",
					urgency: "medium",
					deadline: "本周五",
				},
				riskSignals: [],
				reasoning:
					"邮件主题含「审批」，正文含金额表、截止日期，典型预算审批。",
				suggestions: [
					{
						id: "approve-q3",
						intent: "审批建议",
						message: "预算结构清晰，建议审批通过",
						severity: "info",
						actions: [
							{
								label: "批准",
								tool: "approve_entity",
								params: {},
								confirmRequired: true,
							},
							{
								label: "拒绝",
								tool: "reject_entity",
								params: {},
								confirmRequired: true,
							},
						],
						status: "pending",
					},
				],
			},
			offsetMinutes: -4319,
		},
		{
			type: "email_received",
			content: "收到赵丽（财务部）的回复：要求补充 ROI 明细",
			metadata: { from: "zhaoli@company.com" },
			offsetMinutes: -2880,
		},
		{
			type: "ai_summary",
			content:
				"AI 检测到审批流程变化：财务部要求补充 ROI 数据后才能签批，事项仍处于 pending。",
			metadata: {
				confidence: 0.9,
				categorySlug: "approval",
				extractedFields: {
					反馈人: "赵丽",
					反馈类型: "补充材料",
					需补充: "ROI 预估、Q2 对比、展会线索",
				},
				riskSignals: ["审批流被中断，需等待补充材料"],
				reasoning: "回复邮件要求补充信息，审批尚未完成。",
			},
			offsetMinutes: -2879,
		},
		{
			type: "email_received",
			content: "收到李明的回复：ROI 明细已补充",
			metadata: { from: "liming@company.com" },
			offsetMinutes: -1440,
		},
		{
			type: "ai_summary",
			content:
				"AI 分析：ROI 数据已补充完整，综合获客成本 ¥220/条，较 Q2 下降 15%。审批条件已满足，等待最终批准。",
			metadata: {
				confidence: 0.93,
				categorySlug: "approval",
				progressDelta: 30,
				extractedFields: {
					综合获客成本: "¥220/条",
					Q2对比: "下降 15%",
					状态: "等待最终审批",
				},
				riskSignals: [],
				reasoning:
					"补充材料完整回复了财务部要求的三项内容，审批条件满足。",
				suggestions: [
					{
						id: "final-approve",
						intent: "最终审批",
						message: "ROI 数据已补全，建议尽快审批通过",
						severity: "info",
						actions: [
							{
								label: "批准",
								tool: "approve_entity",
								params: {},
								confirmRequired: true,
							},
						],
						status: "pending",
					},
				],
			},
			offsetMinutes: -1439,
		},
	],
};

// ════════════════════════════════════════════════════════════
// APPROVAL: 差旅报销（已完成，2 封邮件）
// ════════════════════════════════════════════════════════════
const approvalTravel: DemoEntity = {
	type: "APPROVAL",
	categorySlug: "approval",
	title: "海外差旅报销 - ¥45,000（已批准）",
	status: "approved",
	aiSummary:
		"销售部张伟的海外差旅报销 ¥45,000 已通过审批。含机票、酒店和餐饮交通。",
	extractedFields: {
		[DEMO_MARKER]: true,
		applicant: "张伟",
		department: "销售部",
		amount: "¥45,000",
		category: "差旅报销",
		approvedBy: "张总",
	},
	threads: [
		{
			subject: "【报销】海外客户拜访差旅费 - ¥45,000",
			sender: "zhangwei@company.com",
			senderName: "张伟",
			toRecipients: r([{ name: "张总", address: "zhangs@company.com" }]),
			snippet: "张总好，附件是上周海外客户拜访差旅报销。",
			bodyText:
				"张总好，\n\n附件是上周海外客户拜访差旅报销：\n- 往返机票：¥18,000\n- 酒店（3晚）：¥15,000\n- 餐饮交通：¥12,000\n合计 ¥45,000\n\n张伟 | 销售部",
			bodyHtml: h(`
				<p>张总好，</p>
				<p>附件是上周海外客户拜访差旅报销，明细如下：</p>
				<table style="border-collapse:collapse;width:100%;margin:12px 0">
					<tr style="background:#f8f9fa"><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">项目</td><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;text-align:right">金额</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">往返机票</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥18,000</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">酒店（3 晚）</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥15,000</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">餐饮交通</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥12,000</td></tr>
					<tr style="background:#f8f9fa;font-weight:700"><td style="padding:8px 12px;border:1px solid #e5e7eb">合计</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">¥45,000</td></tr>
				</table>
				<p>此次拜访已签下合作意向书，预计 Q3 可签约 ¥500,000。</p>
				<p style="color:#6b7280">张伟 | 销售部</p>
			`),
			receivedAtOffset: -10080,
		},
		{
			subject: "Re: 【报销】海外客户拜访差旅费 - 已批准",
			sender: "zhangs@company.com",
			senderName: "张总",
			toRecipients: r([
				{ name: "张伟", address: "zhangwei@company.com" },
				{ name: "财务部", address: "finance@company.com" },
			]),
			snippet: "已批准，请财务部安排打款。",
			bodyText: "张伟，\n\n差旅报销已批准。财务部请安排打款。\n\n——张总",
			bodyHtml: h(`
				<div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px;border-radius:8px;margin:8px 0">
					<p style="color:#166534;font-weight:600;margin:0">✅ 差旅报销已批准</p>
					<p style="color:#166534;margin:4px 0 0">财务部请安排打款，金额 ¥45,000。</p>
				</div>
				<p style="color:#6b7280;margin-top:12px">——张总</p>
			`),
			receivedAtOffset: -8640,
		},
	],
	timeline: [
		{
			type: "email_received",
			content: "收到张伟（销售部）的差旅报销申请",
			metadata: { from: "zhangwei@company.com" },
			offsetMinutes: -10080,
		},
		{
			type: "ai_summary",
			content:
				"AI 识别为差旅报销。¥45,000，含机票/酒店/餐饮。拜访签下合作意向书。",
			metadata: {
				confidence: 0.94,
				categorySlug: "approval",
				extractedFields: {
					applicant: "张伟",
					amount: "¥45,000",
					category: "差旅报销",
				},
				riskSignals: [],
				reasoning: "典型差旅报销结构，金额明细清晰。",
			},
			offsetMinutes: -10079,
		},
		{
			type: "email_received",
			content: "收到张总的回复：差旅报销已批准",
			metadata: { from: "zhangs@company.com" },
			offsetMinutes: -8640,
		},
		{
			type: "ai_summary",
			content:
				"AI 检测到审批状态变更：张总已批准该报销申请，通知财务打款。",
			metadata: {
				confidence: 0.97,
				categorySlug: "approval",
				extractedFields: { 审批人: "张总", 结果: "已批准" },
				riskSignals: [],
				reasoning: "回复邮件明确表示批准，并抄送财务部安排打款。",
			},
			offsetMinutes: -8639,
		},
		{
			type: "action_taken",
			content: "张总已审批通过",
			metadata: { action: "approved", by: "张总" },
			offsetMinutes: -8638,
		},
		{
			type: "status_changed",
			content: "状态更新：pending → approved",
			metadata: { from: "pending", to: "approved" },
			offsetMinutes: -8638,
		},
	],
};

// ════════════════════════════════════════════════════════════
// REPORT: 产品 v2.0 连续 3 周周报合并
// ════════════════════════════════════════════════════════════
const reportProduct: DemoEntity = {
	type: "REPORT",
	categorySlug: "report",
	title: "产品团队 v2.0 开发进度跟踪",
	status: "in_progress",
	aiSummary:
		"v2.0 连续 3 周追踪：进度从 45% → 58% → 65%。用户系统和支付模块已完成，数据分析模块开发中。当前阻塞：第三方支付接口延迟。",
	extractedFields: {
		[DEMO_MARKER]: true,
		reporter: "陈晓",
		period: "weekly",
		overallStatus: "at_risk",
		progress: "65%",
		completedItems: [
			"用户系统重构（性能+40%）",
			"支付模块上线通过审计",
			"RBAC 改版完成",
		],
		inProgressItems: ["数据分析模块（预计下周完成）", "API 文档（80%）"],
		blockers: ["第三方支付接口延迟交付，影响商户入驻"],
		nextActions: [
			"联系支付供应商确认交付",
			"启动压力测试",
			"准备内部 Beta",
		],
		risk: "中",
	},
	threads: [
		{
			subject: "【周报】产品团队 v2.0 进度 - W22（45%）",
			sender: "chenxiao@company.com",
			senderName: "陈晓",
			toRecipients: r([
				{ name: "张总", address: "zhangs@company.com" },
				{ name: "产品组", address: "product@company.com" },
			]),
			snippet: "本周 v2.0 整体进度 45%，用户系统基础框架完成。",
			bodyText:
				"各位好，\n\nv2.0 W22 进度：45%\n\n✅ 已完成：用户系统基础框架、数据库迁移\n🔄 进行中：支付模块开发、UI 重构\n📋 下周：完成支付模块联调\n\n陈晓 | 产品部",
			bodyHtml: h(`
				<p>各位好，v2.0 第 22 周进度报告：</p>
				<div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 6px 6px 0;margin:12px 0">
					<strong style="font-size:16px">整体进度：45%</strong>
					<div style="background:#e5e7eb;border-radius:4px;height:8px;margin-top:8px"><div style="background:#3b82f6;width:45%;height:100%;border-radius:4px"></div></div>
				</div>
				<h4 style="color:#16a34a">✅ 已完成</h4>
				<ul style="padding-left:20px;color:#4b5563"><li>用户系统基础框架搭建</li><li>数据库 schema 迁移</li></ul>
				<h4 style="color:#2563eb">🔄 进行中</h4>
				<ul style="padding-left:20px;color:#4b5563"><li>支付模块核心逻辑开发</li><li>前端 UI 组件重构</li></ul>
				<p style="color:#6b7280;margin-top:16px">陈晓 | 产品部</p>
			`),
			receivedAtOffset: -20160,
		},
		{
			subject: "【周报】产品团队 v2.0 进度 - W23（58%）",
			sender: "chenxiao@company.com",
			senderName: "陈晓",
			toRecipients: r([
				{ name: "张总", address: "zhangs@company.com" },
				{ name: "产品组", address: "product@company.com" },
			]),
			snippet:
				"本周进度 58%，支付模块已完成联调。发现第三方接口延迟风险。",
			bodyText:
				"各位好，\n\nv2.0 W23 进度：58%（+13%）\n\n✅ 新完成：支付模块联调通过、安全审计启动\n🔄 进行中：RBAC 改版、数据分析模块启动\n🚨 风险：第三方支付接口可能延迟 1-2 周\n📋 下周：完成 RBAC、推进数据分析模块\n\n陈晓 | 产品部",
			bodyHtml: h(`
				<p>各位好，v2.0 第 23 周进度报告：</p>
				<div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 6px 6px 0;margin:12px 0">
					<strong style="font-size:16px">整体进度：58%</strong><span style="color:#16a34a;font-weight:600;margin-left:8px">↑ +13%</span>
					<div style="background:#e5e7eb;border-radius:4px;height:8px;margin-top:8px"><div style="background:linear-gradient(90deg,#3b82f6,#60a5fa);width:58%;height:100%;border-radius:4px"></div></div>
				</div>
				<h4 style="color:#16a34a">✅ 新完成</h4>
				<ul style="padding-left:20px;color:#4b5563"><li>支付模块联调通过</li><li>安全审计启动</li></ul>
				<h4 style="color:#2563eb">🔄 进行中</h4>
				<ul style="padding-left:20px;color:#4b5563"><li>权限体系 RBAC 改版</li><li>数据分析模块启动</li></ul>
				<div style="background:#fef2f2;border:1px solid #fecaca;padding:10px 14px;border-radius:6px;margin:12px 0;color:#991b1b">
					<strong>⚠️ 风险</strong>：第三方支付接口可能延迟 1-2 周交付
				</div>
				<p style="color:#6b7280;margin-top:16px">陈晓 | 产品部</p>
			`),
			receivedAtOffset: -10080,
		},
		{
			subject: "【周报】产品团队 v2.0 进度 - W24（65%）",
			sender: "chenxiao@company.com",
			senderName: "陈晓",
			toRecipients: r([
				{ name: "张总", address: "zhangs@company.com" },
				{ name: "产品组", address: "product@company.com" },
			]),
			snippet: "本周进度 65%，RBAC 完成，第三方支付仍在延迟。",
			bodyText:
				"各位好，\n\nv2.0 W24 进度：65%（+7%）\n\n✅ 新完成：用户系统重构（+40%）、RBAC 改版、支付模块安全审计通过\n🔄 进行中：数据分析模块、API 文档 80%\n🚨 阻塞：第三方支付接口延迟，影响商户入驻\n📋 下周：联系供应商、压力测试、准备内部 Beta\n\n陈晓 | 产品部",
			bodyHtml: h(`
				<p>各位好，v2.0 第 24 周进度报告：</p>
				<div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 6px 6px 0;margin:12px 0">
					<strong style="font-size:16px">整体进度：65%</strong><span style="color:#16a34a;font-weight:600;margin-left:8px">↑ +7%</span>
					<div style="background:#e5e7eb;border-radius:4px;height:8px;margin-top:8px"><div style="background:linear-gradient(90deg,#3b82f6,#60a5fa);width:65%;height:100%;border-radius:4px"></div></div>
				</div>
				<h4 style="color:#16a34a">✅ 已完成</h4>
				<ul style="padding-left:20px;color:#4b5563"><li>用户系统完整重构，<strong>性能提升 40%</strong></li><li>支付模块上线并通过安全审计</li><li>权限体系 RBAC 改版完成</li></ul>
				<h4 style="color:#2563eb">🔄 进行中</h4>
				<ul style="padding-left:20px;color:#4b5563"><li>数据分析模块开发中（预计下周完成）</li><li>API 文档编写（完成 80%）</li></ul>
				<div style="background:#fef2f2;border:1px solid #fecaca;padding:10px 14px;border-radius:6px;margin:12px 0;color:#991b1b">
					<strong>🚨 阻塞</strong>：第三方支付接口延迟交付，影响商户入驻流程<br/><span style="color:#b91c1c">→ 已联系供应商催促，等待回复</span>
				</div>
				<h4>📋 下周计划</h4>
				<ol style="padding-left:20px;color:#4b5563"><li>联系支付供应商确认交付时间</li><li>启动性能压力测试</li><li>准备 v2.0 内部 Beta 测试</li></ol>
				<p style="color:#6b7280;margin-top:16px">陈晓 | 产品部</p>
			`),
			receivedAtOffset: -180,
		},
	],
	timeline: [
		{
			type: "email_received",
			content: "收到陈晓 W22 周报：v2.0 进度 45%",
			metadata: { from: "chenxiao@company.com" },
			offsetMinutes: -20160,
		},
		{
			type: "ai_summary",
			content: "AI 分析 W22：进度 45%，基础框架完成，下周重点支付模块。",
			metadata: {
				confidence: 0.91,
				categorySlug: "report",
				progressDelta: null,
				extractedFields: { progress: "45%", overallStatus: "on_track" },
				riskSignals: [],
				reasoning: "首次周报，项目按计划推进。",
			},
			offsetMinutes: -20159,
		},
		{
			type: "email_received",
			content: "收到陈晓 W23 周报：v2.0 进度 58%（+13%）",
			metadata: { from: "chenxiao@company.com" },
			offsetMinutes: -10080,
		},
		{
			type: "ai_summary",
			content:
				"AI 分析 W23：进度从 45% 升至 58%，但发现第三方支付接口延迟风险。",
			metadata: {
				confidence: 0.93,
				categorySlug: "report",
				progressDelta: 13,
				extractedFields: {
					progress: "58%",
					overallStatus: "at_risk",
					risk: "中",
				},
				riskSignals: ["第三方支付接口可能延迟 1-2 周"],
				reasoning: "进展良好但出现外部依赖风险，标记为 at_risk。",
			},
			offsetMinutes: -10079,
		},
		{
			type: "email_received",
			content: "收到陈晓 W24 周报：v2.0 进度 65%（+7%）",
			metadata: { from: "chenxiao@company.com" },
			offsetMinutes: -180,
		},
		{
			type: "ai_summary",
			content:
				"AI 分析 W24：进度 65%，3 大模块已完成。第三方支付阻塞仍未解决，建议跟进供应商。",
			metadata: {
				confidence: 0.93,
				categorySlug: "report",
				progressDelta: 7,
				extractedFields: {
					progress: "65%",
					overallStatus: "at_risk",
					risk: "中",
					blocker: "第三方支付接口延迟",
				},
				riskSignals: ["第三方依赖延迟，可能导致上线延期 1-2 周"],
				reasoning: "连续 3 周追踪，进度稳定但阻塞未解决。",
				suggestions: [
					{
						id: "vendor-followup",
						intent: "风险升级",
						message: "支付接口已连续 2 周阻塞，建议升级处理",
						severity: "warning",
						actions: [
							{
								label: "发送催促邮件",
								tool: "send_email",
								params: { template: "vendor_followup" },
								confirmRequired: true,
							},
						],
						status: "pending",
					},
				],
			},
			offsetMinutes: -179,
		},
	],
};

// ════════════════════════════════════════════════════════════
// REPORT: Q2 销售汇报（2 封 — 月报 + 管理层追问）
// ════════════════════════════════════════════════════════════
const reportSales: DemoEntity = {
	type: "REPORT",
	categorySlug: "report",
	title: "Q2 销售业绩月度汇报",
	status: "completed",
	aiSummary:
		"Q2 目标达成率 112%，新签 23 家，续约率 95%。华东区 130% 表现突出。管理层追问华南区后已提供详细说明。",
	extractedFields: {
		[DEMO_MARKER]: true,
		reporter: "刘洋",
		period: "monthly",
		overallStatus: "on_track",
		completedItems: [
			"新签客户 23 家（达成 115%）",
			"续约 45 家（95%）",
			"华东区超额 130%",
		],
		inProgressItems: [
			"华南区大客户下月签约",
			"新产品线渠道拓展（12 家代理商）",
		],
		blockers: [],
		nextActions: ["Q2 末冲刺 5 家大客户", "启动 Q3 销售策略"],
	},
	threads: [
		{
			subject: "【月报】Q2 销售业绩汇报 - 达成率 112%",
			sender: "liuyang@company.com",
			senderName: "刘洋",
			toRecipients: r([
				{ name: "管理层", address: "management@company.com" },
			]),
			snippet: "Q2 第二个月销售目标达成率 112%",
			bodyText:
				"管理层各位好，\n\nQ2 月度业绩：达成率 112%，新签 23 家，续约率 95%。\n华东 130%，华北 105%，华南 92%。\n\n刘洋 | 销售部",
			bodyHtml: h(`
				<p>管理层各位好，Q2 第二个月销售业绩汇报：</p>
				<div style="display:flex;gap:12px;margin:16px 0;flex-wrap:wrap">
					<div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:700;color:#16a34a">112%</div><div style="font-size:12px;color:#6b7280;margin-top:4px">目标达成率</div></div>
					<div style="flex:1;min-width:100px;background:#eff6ff;border-radius:8px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:700;color:#2563eb">23</div><div style="font-size:12px;color:#6b7280;margin-top:4px">新签客户</div></div>
					<div style="flex:1;min-width:100px;background:#faf5ff;border-radius:8px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:700;color:#7c3aed">95%</div><div style="font-size:12px;color:#6b7280;margin-top:4px">续约率</div></div>
				</div>
				<table style="border-collapse:collapse;width:100%;margin:8px 0">
					<tr style="background:#f8f9fa"><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">区域</td><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;text-align:right">达成率</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">华东区</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;color:#16a34a;font-weight:700">130% 🏆</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">华北区</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">105%</td></tr>
					<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">华南区</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;color:#d97706">92%</td></tr>
				</table>
				<p style="color:#6b7280;margin-top:16px">刘洋 | 销售部</p>
			`),
			receivedAtOffset: -10080,
		},
		{
			subject: "Re: 【月报】Q2 销售业绩 - 华南区情况说明",
			sender: "liuyang@company.com",
			senderName: "刘洋",
			toRecipients: r([
				{ name: "管理层", address: "management@company.com" },
			]),
			snippet: "关于华南区 92% 的情况，补充详细说明。",
			bodyText:
				"管理层好，\n\n关于华南区 92% 的情况说明：\n\n1. 两个大客户（合同额 ¥800,000）进入最终谈判阶段，预计下月签约\n2. 新增 3 个渠道代理商已建联\n3. 竞品在华南区加大了折扣力度，我们通过增值服务差异化应对\n\n预计下月华南可追平到 110%+。\n\n刘洋 | 销售部",
			bodyHtml: h(`
				<p>管理层好，</p>
				<p>关于华南区 92% 的情况补充说明：</p>
				<ol style="margin:8px 0;padding-left:20px;color:#4b5563">
					<li>两个大客户（合同额 <strong>¥800,000</strong>）进入最终谈判，<strong>预计下月签约</strong></li>
					<li>新增 3 个渠道代理商已建联</li>
					<li>竞品加大折扣力度，我们通过增值服务差异化应对</li>
				</ol>
				<p style="background:#f0fdf4;padding:8px 12px;border-radius:6px;color:#166534">📈 预计下月华南区可追平到 <strong>110%+</strong></p>
				<p style="color:#6b7280;margin-top:12px">刘洋 | 销售部</p>
			`),
			receivedAtOffset: -8640,
		},
	],
	timeline: [
		{
			type: "email_received",
			content: "收到刘洋 Q2 月度销售汇报",
			metadata: { from: "liuyang@company.com" },
			offsetMinutes: -10080,
		},
		{
			type: "ai_summary",
			content:
				"AI 分析：达成率 112% 超额，华东亮眼 130%，华南 92% 需关注。",
			metadata: {
				confidence: 0.97,
				categorySlug: "report",
				progressDelta: 8,
				extractedFields: {
					达成率: "112%",
					新签: "23 家",
					续约率: "95%",
				},
				riskSignals: [],
				reasoning: "月报结构完整，核心指标超目标。",
			},
			offsetMinutes: -10079,
		},
		{
			type: "email_received",
			content: "收到刘洋补充：华南区情况说明",
			metadata: { from: "liuyang@company.com" },
			offsetMinutes: -8640,
		},
		{
			type: "ai_summary",
			content:
				"AI 更新：华南区 2 笔大客户（¥800K）预计下月签约，预计追平 110%+。竞品压力已有应对策略。",
			metadata: {
				confidence: 0.95,
				categorySlug: "report",
				extractedFields: {
					华南大客户: "¥800,000 待签",
					预计下月达成: "110%+",
				},
				riskSignals: [],
				reasoning: "补充说明解释了华南区缺口原因，有具体改善计划。",
			},
			offsetMinutes: -8639,
		},
		{
			type: "status_changed",
			content: "状态更新：received → completed（汇报已确认）",
			metadata: { from: "received", to: "completed" },
			offsetMinutes: -7200,
		},
	],
};

// ════════════════════════════════════════════════════════════
// ISSUE: API 超时（3 封邮件：报告 → 排查 → 解决）
// ════════════════════════════════════════════════════════════
const issueTimeout: DemoEntity = {
	type: "ISSUE",
	categorySlug: "issue",
	title: "客户 A 系统对接频繁超时",
	status: "in_progress",
	aiSummary:
		"客户 A 报告 API 超时率 40%（>30s），技术团队初步定位为 DB 连接池问题。已调整配置并部署，正在验证效果。",
	extractedFields: {
		[DEMO_MARKER]: true,
		reporter: "客户 A 技术负责人",
		priority: "high",
		category: "技术问题",
		affectedSystem: "订单同步 API",
		nextActions: ["验证修复效果（需观察 24h）", "准备事故报告给客户"],
		inProgressItems: ["DB 连接池参数调整已部署", "运维监控 API 响应时间"],
		blockers: ["等待 24h 稳定性观察期"],
		completedItems: ["初步问题定位：DB 连接池瓶颈"],
	},
	threads: [
		{
			subject: "紧急：API 对接超时严重影响业务",
			sender: "tech@client-a.com",
			senderName: "客户 A 技术负责人",
			toRecipients: r([
				{ name: "技术支持", address: "support@company.com" },
			]),
			snippet: "订单同步 API 从昨天开始频繁超时，超时率约 40%。",
			bodyText:
				"你好，\n\n订单同步 API 从昨天开始频繁超时：\n- 接口：POST /api/v2/orders/sync\n- 超时率：约 40%\n- 平均响应：>30s（正常 <2s）\n\n严重影响业务，请尽快处理。",
			bodyHtml: h(`
				<p>你好，</p>
				<p>订单同步 API 从昨天下午开始频繁超时：</p>
				<div style="background:#fef2f2;border:1px solid #fecaca;padding:14px;border-radius:8px;margin:12px 0">
					<table style="border-collapse:collapse;width:100%">
						<tr><td style="padding:4px 0;color:#6b7280;width:100px">接口</td><td style="padding:4px 0;font-family:monospace;font-size:13px">POST /api/v2/orders/sync</td></tr>
						<tr><td style="padding:4px 0;color:#6b7280">超时率</td><td style="padding:4px 0;color:#dc2626;font-weight:700">约 40%</td></tr>
						<tr><td style="padding:4px 0;color:#6b7280">平均响应</td><td style="padding:4px 0;color:#dc2626;font-weight:700">&gt;30s（正常 &lt;2s）</td></tr>
					</table>
				</div>
				<p style="color:#dc2626;font-weight:600">⚠️ 严重影响业务运转，请尽快处理。</p>
			`),
			receivedAtOffset: -360,
		},
		{
			subject: "Re: API 超时问题 - 已定位原因",
			sender: "wanglei@company.com",
			senderName: "王磊",
			toRecipients: r([
				{ name: "客户 A", address: "tech@client-a.com" },
				{ name: "技术支持", address: "support@company.com" },
			]),
			snippet: "已定位为数据库连接池配置问题，正在修复中。",
			bodyText:
				"你好，\n\n已排查定位问题原因：\n1. 数据库连接池 max_connections 配置过低\n2. 昨天业务量突增导致连接耗尽\n3. 正在调整配置并扩容\n\n预计 2 小时内完成部署。\n\n王磊 | 技术部",
			bodyHtml: h(`
				<p>你好，</p>
				<p>已排查定位问题原因：</p>
				<ol style="margin:8px 0;padding-left:20px;color:#4b5563">
					<li>数据库连接池 <code style="background:#f3f4f6;padding:2px 6px;border-radius:3px">max_connections</code> 配置过低（当前 50，需 200）</li>
					<li>昨天业务量突增 <strong>3 倍</strong>导致连接耗尽</li>
					<li>正在调整配置并扩容实例</li>
				</ol>
				<p style="background:#fffbeb;border:1px solid #fde68a;padding:8px 12px;border-radius:6px;color:#92400e">⏳ 预计 <strong>2 小时内</strong>完成部署修复</p>
				<p style="color:#6b7280;margin-top:12px">王磊 | 技术部</p>
			`),
			receivedAtOffset: -240,
		},
		{
			subject: "Re: API 超时问题 - 修复已部署",
			sender: "wanglei@company.com",
			senderName: "王磊",
			toRecipients: r([
				{ name: "客户 A", address: "tech@client-a.com" },
				{ name: "技术支持", address: "support@company.com" },
			]),
			snippet: "修复已部署，连接池扩容到 200，当前超时率降至 0.5%。",
			bodyText:
				"你好，\n\n修复已部署完成：\n- 连接池：50 → 200\n- 当前超时率：0.5%（恢复正常）\n- 平均响应：1.2s\n\n需要观察 24h 确保稳定。同时准备事故报告给贵方。\n\n王磊 | 技术部",
			bodyHtml: h(`
				<p>你好，</p>
				<p>修复已部署完成，当前状态：</p>
				<div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px;border-radius:8px;margin:12px 0">
					<table style="border-collapse:collapse;width:100%">
						<tr><td style="padding:4px 0;color:#6b7280;width:120px">连接池配置</td><td style="padding:4px 0"><span style="text-decoration:line-through;color:#9ca3af">50</span> → <strong style="color:#16a34a">200</strong></td></tr>
						<tr><td style="padding:4px 0;color:#6b7280">超时率</td><td style="padding:4px 0"><span style="text-decoration:line-through;color:#9ca3af">40%</span> → <strong style="color:#16a34a">0.5%</strong></td></tr>
						<tr><td style="padding:4px 0;color:#6b7280">平均响应</td><td style="padding:4px 0"><span style="text-decoration:line-through;color:#9ca3af">>30s</span> → <strong style="color:#16a34a">1.2s</strong></td></tr>
					</table>
				</div>
				<p>需要观察 24h 确保稳定，同时会准备事故报告给贵方。</p>
				<p style="color:#6b7280;margin-top:12px">王磊 | 技术部</p>
			`),
			receivedAtOffset: -120,
		},
	],
	timeline: [
		{
			type: "email_received",
			content: "收到客户 A 紧急反馈：API 超时率 40%",
			metadata: { from: "tech@client-a.com" },
			offsetMinutes: -360,
		},
		{
			type: "ai_summary",
			content:
				"AI 识别为高优先级技术问题。超时率 40%，响应 >30s，严重影响客户业务。",
			metadata: {
				confidence: 0.91,
				categorySlug: "issue",
				extractedFields: {
					priority: "high",
					超时率: "40%",
					平均响应: ">30s",
				},
				riskSignals: [
					"超时率 40% — 严重影响客户业务",
					"响应 15x 性能下降",
				],
				reasoning: "紧急标题 + 具体 API 路径和超时数据。",
				suggestions: [
					{
						id: "p0-ticket",
						intent: "紧急响应",
						message: "建议立即创建 P0 工单并排查",
						severity: "critical",
						actions: [
							{
								label: "创建紧急工单",
								tool: "create_ticket",
								params: { priority: "P0" },
								confirmRequired: true,
							},
						],
						status: "pending",
					},
				],
			},
			offsetMinutes: -359,
		},
		{
			type: "email_received",
			content: "收到王磊回复：已定位为 DB 连接池问题",
			metadata: { from: "wanglei@company.com" },
			offsetMinutes: -240,
		},
		{
			type: "ai_summary",
			content:
				"AI 更新：根因已定位（连接池 50 不足），正在扩容修复，预计 2h。",
			metadata: {
				confidence: 0.89,
				categorySlug: "issue",
				extractedFields: {
					根因: "连接池配置不足",
					当前值: "50",
					目标值: "200",
				},
				riskSignals: [],
				reasoning: "技术团队已定位根因并提供修复方案。",
			},
			offsetMinutes: -239,
		},
		{
			type: "status_changed",
			content: "状态：pending → in_progress",
			metadata: { from: "pending", to: "in_progress" },
			offsetMinutes: -238,
		},
		{
			type: "email_received",
			content: "收到王磊回复：修复已部署，超时率降至 0.5%",
			metadata: { from: "wanglei@company.com" },
			offsetMinutes: -120,
		},
		{
			type: "ai_summary",
			content:
				"AI 分析：修复效果显著。超时率 40% → 0.5%，响应 >30s → 1.2s。待 24h 观察后可关闭。",
			metadata: {
				confidence: 0.96,
				categorySlug: "issue",
				progressDelta: 80,
				extractedFields: {
					超时率: "40% → 0.5%",
					响应时间: ">30s → 1.2s",
					连接池: "50 → 200",
				},
				riskSignals: [],
				reasoning: "三项核心指标均恢复正常，修复有效。",
				suggestions: [
					{
						id: "close-after-24h",
						intent: "关闭建议",
						message: "建议 24h 后确认稳定并关闭此事项",
						severity: "info",
						actions: [
							{
								label: "标记为已解决",
								tool: "update_entity_status",
								params: { status: "completed" },
								confirmRequired: true,
							},
						],
						status: "pending",
					},
				],
			},
			offsetMinutes: -119,
		},
	],
};

// ════════════════════════════════════════════════════════════
// ISSUE: 发票流程卡点（2 封邮件：催办 + 解决）
// ════════════════════════════════════════════════════════════
const issueInvoice: DemoEntity = {
	type: "ISSUE",
	categorySlug: "issue",
	title: "发票开具流程卡在财务审核",
	status: "completed",
	aiSummary:
		"客户 B 发票（INV-2024-0892，¥186,000）在财务审核停留 5 天后经协调已开具。",
	extractedFields: {
		[DEMO_MARKER]: true,
		reporter: "客户 B 商务",
		priority: "medium",
		category: "流程问题",
		resolution: "已完成审核并开具发票",
	},
	threads: [
		{
			subject: "催办：发票开具已等待 5 天",
			sender: "biz@client-b.com",
			senderName: "客户 B 商务",
			toRecipients: r([
				{ name: "财务部", address: "finance@company.com" },
			]),
			snippet: "发票 INV-2024-0892 已提交 5 个工作日，至今未收到。",
			bodyText:
				"你好，\n\n发票申请 INV-2024-0892（¥186,000）已提交 5 天，未收到。请问进度如何？",
			bodyHtml: h(`
				<p>你好，</p>
				<p>发票申请 <strong>INV-2024-0892</strong>（¥186,000）已提交 5 个工作日：</p>
				<div style="background:#fffbeb;border:1px solid #fde68a;padding:14px;border-radius:8px;margin:12px 0">
					<table style="border-collapse:collapse;width:100%">
						<tr><td style="padding:4px 0;color:#6b7280;width:100px">申请编号</td><td style="padding:4px 0;font-weight:600">INV-2024-0892</td></tr>
						<tr><td style="padding:4px 0;color:#6b7280">金额</td><td style="padding:4px 0;font-weight:600">¥186,000</td></tr>
						<tr><td style="padding:4px 0;color:#6b7280">状态</td><td style="padding:4px 0;color:#d97706;font-weight:600">⏳ 财务审核中（5天）</td></tr>
					</table>
				</div>
			`),
			receivedAtOffset: -7200,
		},
		{
			subject: "Re: 发票 INV-2024-0892 已开具",
			sender: "finance@company.com",
			senderName: "财务部",
			toRecipients: r([{ name: "客户 B", address: "biz@client-b.com" }]),
			snippet: "抱歉久等，发票已开具并邮寄。",
			bodyText:
				"你好，\n\n抱歉让您久等了。发票 INV-2024-0892 已完成审核并开具，快递已寄出（顺丰 SF123456789）。\n\n财务部",
			bodyHtml: h(`
				<p>你好，</p>
				<p>抱歉让您久等了。发票已处理完成：</p>
				<div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px;border-radius:8px;margin:12px 0">
					<p style="color:#166534;font-weight:600;margin:0">✅ 发票 INV-2024-0892 已开具</p>
					<p style="color:#166534;margin:4px 0 0">快递单号：<code style="background:#dcfce7;padding:2px 6px;border-radius:3px">SF123456789</code></p>
				</div>
				<p style="color:#6b7280">财务部</p>
			`),
			receivedAtOffset: -1440,
		},
	],
	timeline: [
		{
			type: "email_received",
			content: "收到客户 B 催办发票开具（已等 5 天）",
			metadata: { from: "biz@client-b.com" },
			offsetMinutes: -7200,
		},
		{
			type: "ai_summary",
			content:
				"AI 识别为流程卡点。发票 INV-2024-0892（¥186K）停留 5 天，超出 SLA。",
			metadata: {
				confidence: 0.88,
				categorySlug: "issue",
				extractedFields: {
					发票号: "INV-2024-0892",
					金额: "¥186,000",
					等待: "5 天",
				},
				riskSignals: ["流程停滞 5 天 — 超出正常 SLA"],
				reasoning: "催办邮件包含发票编号和等待时间。",
			},
			offsetMinutes: -7199,
		},
		{
			type: "email_received",
			content: "收到财务部回复：发票已开具并邮寄",
			metadata: { from: "finance@company.com" },
			offsetMinutes: -1440,
		},
		{
			type: "ai_summary",
			content: "AI 检测到问题已解决：发票已开具，快递 SF123456789。",
			metadata: {
				confidence: 0.95,
				categorySlug: "issue",
				extractedFields: { 结果: "已开具", 快递: "SF123456789" },
				riskSignals: [],
				reasoning: "回复明确表示发票已处理完成并邮寄。",
			},
			offsetMinutes: -1439,
		},
		{
			type: "action_taken",
			content: "财务部已完成审核并开具发票",
			metadata: { action: "resolved", by: "财务部" },
			offsetMinutes: -1438,
		},
		{
			type: "status_changed",
			content: "状态更新：pending → completed",
			metadata: { from: "pending", to: "completed" },
			offsetMinutes: -1438,
		},
	],
};

const DEMO_DATA: Record<string, DemoEntity[]> = {
	approval: [approvalBudget, approvalTravel],
	report: [reportProduct, reportSales],
	issue: [issueTimeout, issueInvoice],
};

export const seedDemo = protectedProcedure
	.route({
		method: "POST",
		path: "/flow-entities/seed-demo",
		tags: ["FlowEntities"],
		summary: "Generate demo data for selected scenes",
	})
	.input(seedDemoSchema)
	.handler(async ({ input, context }) => {
		await requireOrgMembership(input.organizationId, context.user.id);

		const existing = await db.flowEntity.count({
			where: {
				organizationId: input.organizationId,
				extractedFields: { contains: DEMO_MARKER },
			},
		});

		if (existing > 0) {
			return { created: 0, message: "Demo data already exists" };
		}

		const categoryMap = new Map<string, string>();
		const categories = await db.category.findMany({
			where: { organizationId: input.organizationId },
			select: { id: true, slug: true },
		});
		for (const cat of categories) {
			categoryMap.set(cat.slug, cat.id);
		}

		let demoConnection = await db.emailConnection.findFirst({
			where: {
				organizationId: input.organizationId,
				email: DEMO_CONNECTION_EMAIL,
			},
			select: { id: true },
		});
		if (!demoConnection) {
			demoConnection = await db.emailConnection.create({
				data: {
					organizationId: input.organizationId,
					provider: "demo",
					authType: "demo",
					email: DEMO_CONNECTION_EMAIL,
					isActive: false,
				},
				select: { id: true },
			});
		}

		let created = 0;
		const now = Date.now();

		for (const scene of input.scenes) {
			const templates = DEMO_DATA[scene];
			if (!templates) {
				continue;
			}

			for (const tpl of templates) {
				const categoryId = categoryMap.get(tpl.categorySlug);

				const entity = await db.flowEntity.create({
					data: {
						organizationId: input.organizationId,
						type: tpl.type,
						categoryId: categoryId ?? null,
						title: tpl.title,
						status: tpl.status,
						aiSummary: tpl.aiSummary,
						extractedFields: JSON.stringify(tpl.extractedFields),
					},
				});

				for (const thread of tpl.threads) {
					await db.emailThread.create({
						data: {
							organizationId: input.organizationId,
							connectionId: demoConnection.id,
							externalThreadId: `demo-${entity.id}-${thread.receivedAtOffset}`,
							subject: thread.subject,
							sender: thread.sender,
							senderName: thread.senderName,
							participants: thread.toRecipients,
							toRecipients: thread.toRecipients,
							snippet: thread.snippet,
							bodyHtml: thread.bodyHtml,
							bodyText: thread.bodyText,
							entityId: entity.id,
							receivedAt: new Date(
								now + thread.receivedAtOffset * 60000,
							),
							processedAt: new Date(
								now + thread.receivedAtOffset * 60000 + 60000,
							),
						},
					});
				}

				if (tpl.timeline.length > 0) {
					await db.timelineEvent.createMany({
						data: tpl.timeline.map((evt) => ({
							entityId: entity.id,
							type: evt.type,
							content: evt.content,
							metadata: evt.metadata
								? JSON.stringify(evt.metadata)
								: null,
							createdAt: new Date(
								now + evt.offsetMinutes * 60000,
							),
						})),
					});
				}

				created++;
			}
		}

		return { created, message: `Generated ${created} demo entities` };
	});
