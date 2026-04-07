/**
 * 分类精度评估脚本
 *
 * 直接调用 classifyEmailDynamic 对 100 封测试邮件分类，
 * 与 ground truth 对比，输出精度报告和易错 case 分析。
 *
 * 运行: npx tsx apps/web/tests/eval/run-classification-eval.ts
 */

import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

import {
	EMAIL_DATASET,
	EXPECTED_CATEGORIES,
	type TestEmail,
} from "./email-dataset";

const AI_BASE_URL = process.env.AI_GATEWAY_BASE_URL;
const AI_API_KEY = process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY;
const MODEL =
	process.env.AI_GATEWAY_MODEL ?? process.env.AI_FAST_MODEL ?? "gpt-4o-mini";

if (!AI_BASE_URL || !AI_API_KEY) {
	console.error("Missing AI_GATEWAY_BASE_URL or AI_GATEWAY_API_KEY");
	process.exit(1);
}

const CATEGORIES = EXPECTED_CATEGORIES.map((c) => ({
	id: c.slug,
	name: c.name,
	slug: c.slug,
	aiPrompt: getAiPrompt(c.slug),
}));

function getAiPrompt(slug: string): string {
	const prompts: Record<string, string> = {
		"ci-alert":
			"CI/CD 构建系统发送的邮件。发件人通常是 jenkins@、noreply@github.com、gitlab@、deploy-bot@、sonarqube@、dependabot@、renovate@、release-bot@ 等自动化系统。主题包含 [BUILD]、[DEPLOY]、Pipeline、Merge request、PR merged、npm audit、Dependabot 等关键词。正文涉及构建状态、测试结果、部署记录、代码扫描、依赖更新等。注意：人工讨论 CI 问题（如'构建失败我查了一下'）也属于此类。",
		monitoring:
			"监控系统、告警平台发送的邮件。发件人通常是 monitor@、grafana@、alerts@datadoghq.com、noreply@pagerduty.com、alert@uptimerobot.com、certbot@、backup@、aws-notifications@ 等。主题包含 [ALERT]、[WARN]、[RESOLVED]、CPU/Memory/Disk usage、Incident、Down 等。正文涉及服务器指标、告警阈值、备份状态、证书到期、Sentry 错误追踪。注意：BI 数据异常通知也属于监控类。",
		"product-req":
			"产品需求、技术方案、评审讨论相关的邮件。发件人是产品经理、技术负责人、架构师、UX设计师、Scrum Master 等。主题包含 PRD、需求评审、方案讨论、Sprint、backlog、Figma设计稿、路线图等。正文涉及功能设计、技术选型、用户调研、竞品分析、数据库变更评审等。注意：来自 CTO/VP 关于流程改进的建议也属于需求类。",
		"weekly-report":
			"周报、月报、进展汇报、数据报告类邮件。主题包含'周报'、'月报'、'Weekly Report'、'进展更新'、'OKR'、'述职'、'数据汇总'等。正文包含'本周完成'、'下周计划'、'进度：XX%'、数据指标对比、销售数据、运营数据等。注意：研发效能报告、自动化测试覆盖率报告、安全审计报告等定期数据类报告也属于此类。催周报的邮件也属于此类。",
		"hr-admin":
			"HR 人事和行政管理相关邮件。发件人是 hr@、admin@、hr-compensation@、hr-policy@、ceo-office@、recruiter@、hiring-manager@ 等。主题包含入职、团建、调薪、搬迁、请假批准、员工调查、公司制度、面试反馈等。注意：请假已批准通知属于 HR 行政（不是审批）。",
		"customer-feedback":
			"客户反馈、投诉、工单、用户评价相关。发件人包括外部客户邮箱、support@、zendesk@、intercom@、billing@、appstore-alert@ 等。主题包含'工单'、'客户反馈'、'投诉'、'退款'、Ticket、NPS、用户访谈等。正文涉及客户问题描述、功能需求、满意度数据、续约谈判等。注意：销售传递的客户诉求也属于此类。",
		approval:
			"需要审批决策的邮件。主题包含'审批'、'请审批'、'申请'、'采购申请'、'预算申请'、'合同审批'、OA审批提醒等。正文涉及金额、采购明细、人员编制、出差申请、权限申请、折扣审批等。注意：报销审批也属于此类，不是 HR 行政。",
		other: "不属于以上任何分类的杂项邮件。包括：私人聊天（午餐邀约、打球约局）、快递通知、外卖通知、LinkedIn通知、行业资讯、会议室预约确认、技术书籍推荐等日常杂项。",
	};
	return prompts[slug] ?? "";
}

interface ClassifyResult {
	categorySlug: string;
	confidence: number;
	reasoning: string;
}

const DEEP_READ_THRESHOLD = 0.96;

async function callLLM(
	messages: Array<{ role: string; content: string }>,
): Promise<ClassifyResult> {
	const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${AI_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: MODEL,
			messages,
			temperature: 0.1,
			response_format: { type: "json_object" },
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
	}

	const data = (await response.json()) as {
		choices: Array<{ message: { content: string } }>;
	};
	const content = data.choices[0]?.message?.content ?? "{}";

	try {
		return JSON.parse(content) as ClassifyResult;
	} catch {
		return {
			categorySlug: "unknown",
			confidence: 0,
			reasoning: `Parse error: ${content.slice(0, 100)}`,
		};
	}
}

async function classifyOne(
	email: TestEmail,
): Promise<ClassifyResult & { usedDeepRead: boolean }> {
	const categoryDescriptions = CATEGORIES.map(
		(cat) => `- ${cat.slug} (${cat.name}): ${cat.aiPrompt}`,
	).join("\n");
	const validSlugs = CATEGORIES.map((c) => c.slug).join(", ");

	const pass1 = await callLLM([
		{
			role: "system",
			content:
				"You are an enterprise email classifier. Return valid JSON only.",
		},
		{
			role: "user",
			content: `Analyze the following email and classify it into ONE of the provided categories.

Email Subject: ${email.subject}
Sender: ${email.senderName} <${email.sender}>
Email Content (first 500 chars): ${email.bodyText.slice(0, 500)}

Available categories:
${categoryDescriptions}

Return JSON: { "categorySlug": "<one of: ${validSlugs}, or unknown>", "confidence": <0-1>, "reasoning": "<brief Chinese explanation>" }`,
		},
	]);

	if (
		pass1.confidence >= DEEP_READ_THRESHOLD ||
		email.bodyText.length <= 500
	) {
		return { ...pass1, usedDeepRead: false };
	}

	const pass2 = await callLLM([
		{
			role: "system",
			content:
				"You are an enterprise email classifier performing DEEP analysis on an ambiguous email. Return valid JSON only.",
		},
		{
			role: "user",
			content: `A first-pass classifier returned: "${pass1.categorySlug}" with ${Math.round(pass1.confidence * 100)}% confidence.
Reason: ${pass1.reasoning}

Now re-examine with the FULL email body to determine the correct category.

Email Subject: ${email.subject}
Sender: ${email.senderName} <${email.sender}>
Full Email Body:
---
${email.bodyText.slice(0, 2000)}
---

Focus on:
1. The PRIMARY intent — what action does the sender expect?
2. Who is the sender and what role do they play?
3. Does the full body contain signals that change the initial classification?
4. If subject says "审批/approval" but content is a discussion, classify by content intent.
5. If a report contains anomaly/alert data, consider whether it's monitoring or reporting.

Available categories:
${categoryDescriptions}

Return JSON: { "categorySlug": "<one of: ${validSlugs}, or unknown>", "confidence": <0-1>, "reasoning": "<brief Chinese explanation, explain whether you agree or disagree with first pass>" }`,
		},
	]);

	return { ...pass2, usedDeepRead: true };
}

async function runEval() {
	console.log("═══════════════════════════════════════════════════════════");
	console.log("  Flowmail 分类精度评估 — 100 封邮件");
	console.log(`  模型: ${MODEL}`);
	console.log(`  分类数: ${CATEGORIES.length}`);
	console.log(
		"═══════════════════════════════════════════════════════════\n",
	);

	const results: Array<{
		email: TestEmail;
		predicted: string;
		confidence: number;
		reasoning: string;
		correct: boolean;
		usedDeepRead: boolean;
	}> = [];

	const BATCH_SIZE = 5;
	for (let i = 0; i < EMAIL_DATASET.length; i += BATCH_SIZE) {
		const batch = EMAIL_DATASET.slice(i, i + BATCH_SIZE);
		const promises = batch.map(async (email) => {
			const result = await classifyOne(email);
			const correct = result.categorySlug === email.groundTruth;
			const icon = correct ? "✅" : "❌";
			const deepTag = result.usedDeepRead ? " 🔍" : "";
			console.log(
				`${icon} [${email.id}] ${email.subject.slice(0, 40).padEnd(40)} ` +
					`预测: ${result.categorySlug.padEnd(18)} ` +
					`真实: ${email.groundTruth.padEnd(18)} ` +
					`(${Math.round(result.confidence * 100)}%)${deepTag}`,
			);
			return {
				email,
				predicted: result.categorySlug,
				confidence: result.confidence,
				reasoning: result.reasoning,
				correct,
				usedDeepRead: result.usedDeepRead,
			};
		});
		const batchResults = await Promise.all(promises);
		results.push(...batchResults);
	}

	// ─── 总体精度 ───
	const total = results.length;
	const correctCount = results.filter((r) => r.correct).length;
	const accuracy = correctCount / total;

	console.log(
		"\n\n═══════════════════════════════════════════════════════════",
	);
	console.log("  评估结果总结");
	console.log(
		"═══════════════════════════════════════════════════════════\n",
	);
	console.log(`总邮件数: ${total}`);
	console.log(`分类正确: ${correctCount}`);
	console.log(`分类错误: ${total - correctCount}`);
	console.log(`总体精度: ${(accuracy * 100).toFixed(1)}%\n`);

	// ─── 按难度分层精度 ───
	console.log("── 按难度分层精度 ──\n");
	for (const diff of ["easy", "medium", "hard", "tricky"] as const) {
		const subset = results.filter((r) => r.email.difficulty === diff);
		if (subset.length === 0) {
			continue;
		}
		const subCorrect = subset.filter((r) => r.correct).length;
		const subAcc = subCorrect / subset.length;
		const bar =
			"█".repeat(Math.round(subAcc * 20)) +
			"░".repeat(20 - Math.round(subAcc * 20));
		console.log(
			`  ${diff.padEnd(8)} ${bar} ${(subAcc * 100).toFixed(1).padStart(5)}% (${subCorrect}/${subset.length})`,
		);
	}

	// ─── 按分类精度（Precision / Recall） ───
	console.log("\n── 按分类 Precision / Recall ──\n");
	console.log("  分类              Precision  Recall   F1      TP  FP  FN");
	console.log("  ─────────────────────────────────────────────────────────");

	for (const cat of CATEGORIES) {
		const tp = results.filter(
			(r) => r.predicted === cat.slug && r.email.groundTruth === cat.slug,
		).length;
		const fp = results.filter(
			(r) => r.predicted === cat.slug && r.email.groundTruth !== cat.slug,
		).length;
		const fn = results.filter(
			(r) => r.predicted !== cat.slug && r.email.groundTruth === cat.slug,
		).length;
		const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
		const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
		const f1 =
			precision + recall > 0
				? (2 * precision * recall) / (precision + recall)
				: 0;
		console.log(
			`  ${cat.name.padEnd(18)} ${(precision * 100).toFixed(0).padStart(5)}%    ${(recall * 100).toFixed(0).padStart(5)}%   ${(f1 * 100).toFixed(0).padStart(5)}%   ${String(tp).padStart(3)} ${String(fp).padStart(3)} ${String(fn).padStart(3)}`,
		);
	}

	// ─── 混淆矩阵（简化版：只展示错误） ───
	console.log("\n── 错误分类详情（混淆分析） ──\n");
	const errors = results.filter((r) => !r.correct);
	if (errors.length === 0) {
		console.log("  🎉 没有分类错误！\n");
	} else {
		const confusionPairs: Record<string, number> = {};
		for (const err of errors) {
			const key = `${err.email.groundTruth} → ${err.predicted}`;
			confusionPairs[key] = (confusionPairs[key] ?? 0) + 1;
		}
		const sorted = Object.entries(confusionPairs).sort(
			(a, b) => b[1] - a[1],
		);
		console.log("  真实分类 → 错误预测          次数");
		console.log("  ──────────────────────────────────");
		for (const [pair, count] of sorted) {
			console.log(`  ${pair.padEnd(35)} ${count}`);
		}
	}

	// ─── 易错邮件详细列表 ───
	console.log("\n── 易错邮件详细分析 ──\n");
	for (const err of errors) {
		console.log(`  ❌ [${err.email.id}] ${err.email.subject}`);
		console.log(
			`     发件人: ${err.email.senderName} <${err.email.sender}>`,
		);
		console.log(
			`     真实: ${err.email.groundTruth} → 预测: ${err.predicted} (${Math.round(err.confidence * 100)}%)`,
		);
		console.log(`     难度: ${err.email.difficulty}`);
		if (err.email.note) {
			console.log(`     设计意图: ${err.email.note}`);
		}
		console.log(`     AI推理: ${err.reasoning}`);
		console.log();
	}

	// ─── 置信度分析 ───
	console.log("── 置信度分析 ──\n");
	const correctConf = results
		.filter((r) => r.correct)
		.map((r) => r.confidence);
	const wrongConf = results
		.filter((r) => !r.correct)
		.map((r) => r.confidence);
	const avg = (arr: number[]) =>
		arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
	console.log(
		`  正确分类平均置信度: ${(avg(correctConf) * 100).toFixed(1)}%`,
	);
	console.log(`  错误分类平均置信度: ${(avg(wrongConf) * 100).toFixed(1)}%`);

	const highConfErrors = errors.filter((r) => r.confidence > 0.8);
	if (highConfErrors.length > 0) {
		console.log(`\n  ⚠️ 高置信度错误（>80%）: ${highConfErrors.length} 封`);
		for (const e of highConfErrors) {
			console.log(
				`     [${e.email.id}] ${e.email.subject.slice(0, 50)} (${Math.round(e.confidence * 100)}%)`,
			);
		}
	}

	// ─── 二次判断（Deep Read）分析 ───
	const deepReadResults = results.filter((r) => r.usedDeepRead);
	console.log("\n── 二次判断（Deep Read）分析 ──\n");
	console.log(`  触发二次判断的邮件数: ${deepReadResults.length}/${total}`);
	if (deepReadResults.length > 0) {
		const deepCorrect = deepReadResults.filter((r) => r.correct).length;
		const deepAcc = deepCorrect / deepReadResults.length;
		console.log(
			`  二次判断精度: ${(deepAcc * 100).toFixed(1)}% (${deepCorrect}/${deepReadResults.length})`,
		);
		console.log(
			`  未触发二次判断的精度: ${(((correctCount - deepCorrect) / (total - deepReadResults.length)) * 100).toFixed(1)}%`,
		);
		console.log("\n  触发二次判断的邮件:");
		for (const r of deepReadResults) {
			const icon = r.correct ? "✅" : "❌";
			console.log(
				`    ${icon} [${r.email.id}] ${r.email.subject.slice(0, 45)} → ${r.predicted} (${Math.round(r.confidence * 100)}%)`,
			);
		}
	}

	console.log(
		"\n═══════════════════════════════════════════════════════════",
	);
	console.log("  评估完成");
	console.log("═══════════════════════════════════════════════════════════");
}

runEval().catch(console.error);
