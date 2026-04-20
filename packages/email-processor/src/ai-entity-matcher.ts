import { db } from "@repo/database";
import { fastModel, safeGenerateObject, zConfidence } from "@repo/ai";
import { z } from "zod";

/**
 * AI 项目合并匹配器
 *
 * 思路：
 * 1. 用 SQL 缩小候选池（同组织 + 最近 N 天有活动 + 最多 K 个 entity）
 * 2. 把候选 entity 的标题/摘要/最近邮件主题列出来，让 fast model 二选一：
 *    - 命中某个候选 → 返回 entityId
 *    - 都不是同一项目 → 返回 null
 *
 * 比规则匹配的优势：理解语义（"Blue Sky Lockhart 4月报告" vs "blue-sky-april.pdf 月报"）
 * 成本：fast model + 短 prompt，每次约 200~500 tokens，几乎免费。
 */

const CANDIDATE_LOOKBACK_DAYS = 60;
const MAX_CANDIDATES = 30;
const MIN_CONFIDENCE = 0.7;

const MatchResultSchema = z.object({
	matchedEntityId: z
		.string()
		.nullable()
		.describe("命中的 entity id；若都不是同一项目则返回 null"),
	confidence: zConfidence(),
	reasoning: z.string().transform((s) => s.slice(0, 300)),
});

export interface AiEntityMatchInput {
	organizationId: string;
	subject: string;
	sender: string;
	senderEmail: string;
	content: string;
}

export interface AiEntityMatchResult {
	entityId: string;
	matchedTitle: string;
	confidence: number;
	reasoning: string;
}

export async function findEntityByAiMatch(
	input: AiEntityMatchInput,
): Promise<AiEntityMatchResult | null> {
	const cutoff = new Date(
		Date.now() - CANDIDATE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
	);

	// 候选池：近 60 天有活动且未被过滤的 entity
	const candidates = await db.flowEntity.findMany({
		where: {
			organizationId: input.organizationId,
			isFiltered: false,
			updatedAt: { gte: cutoff },
		},
		select: {
			id: true,
			title: true,
			aiSummary: true,
			category: { select: { name: true } },
			threads: {
				select: { subject: true },
				orderBy: { receivedAt: "desc" },
				take: 3,
			},
		},
		orderBy: { updatedAt: "desc" },
		take: MAX_CANDIDATES,
	});

	if (candidates.length === 0) {
		return null;
	}

	const candidateLines = candidates.map((c, idx) => {
		const recentSubjects = c.threads
			.map((t) => t.subject)
			.filter(Boolean)
			.join(" | ");
		const summary = c.aiSummary?.slice(0, 150) ?? "";
		const cat = c.category?.name ?? "未分类";
		return `[${idx + 1}] id=${c.id} | 类别=${cat} | 标题=${c.title}${summary ? `\n    摘要: ${summary}` : ""}${recentSubjects ? `\n    近期邮件: ${recentSubjects}` : ""}`;
	});

	const result = await safeGenerateObject({
		model: fastModel,
		schema: MatchResultSchema,
		prompt: `你是邮件项目合并判断器。判断一封新邮件是否属于已存在的某个项目/事项。

【新邮件】
主题: ${input.subject}
发件人: ${input.sender} <${input.senderEmail}>
正文(前 800 字): ${input.content.slice(0, 800)}

【候选项目列表】（最多 ${MAX_CANDIDATES} 个）
${candidateLines.join("\n")}

判断规则：
1. 严格按"业务项目/事项"维度判断，不只看主题字面相似
2. 同一项目典型特征：同一公司/产品/客户/合同号、同一业务流程的延续邮件、同一份月报的不同版本、同一审批的回复链
3. 不同项目的特征：不同公司、不同合同、不同部门事务，即使主题里都包含"月报""审批"等通用词
4. 如果新邮件是营销/通知/无关内容，或与所有候选都无关，返回 matchedEntityId=null
5. 不确定时倾向于不合并（confidence 设低或返回 null）

返回字段：
- matchedEntityId: 命中候选的 id（必须是上面列出的某个 id），或 null
- confidence: 0-1，0.7 以上才会真合并
- reasoning: 简短说明（≤ 150 字）`,
	});

	if (!result.matchedEntityId) {
		return null;
	}
	if (result.confidence < MIN_CONFIDENCE) {
		console.log(
			`[ai-entity-matcher] low confidence ${result.confidence}, skipping merge: ${result.reasoning}`,
		);
		return null;
	}

	const matched = candidates.find((c) => c.id === result.matchedEntityId);
	if (!matched) {
		console.warn(
			`[ai-entity-matcher] AI returned unknown entityId ${result.matchedEntityId}, ignoring`,
		);
		return null;
	}

	return {
		entityId: matched.id,
		matchedTitle: matched.title,
		confidence: result.confidence,
		reasoning: result.reasoning,
	};
}
