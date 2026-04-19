/**
 * Per-email AI 提炼模块
 *
 * 在 entity 级别的 ai_summary 之外，给"每一封"邮件单独生成一份 AI 提炼笔记，
 * 包含：要点、与上封邮件的 delta、建议动作、重要性评分。
 *
 * 触发时机：
 *  - inbound.ts 入库后通过 triggerEmailAiNoteIfNeeded 智能判定（节省 token）
 *  - 详情页打开时通过 analyzeAllPendingEmails 懒加载补齐
 *  - Agent 工具 analyze_each_email / regenerate_entity_narrative 手动触发
 *
 * UI 在 EntityTimeline.tsx 通过 metadata.threadId 锚定到对应邮件节点展示。
 */

import { fastModel, generateText, safeGenerateObject, textModel } from "@repo/ai";
import { db } from "@repo/database";
import { z } from "zod";
import { readEntityAttachments } from "./attachment-reader";

const LOG_TAG = "[EmailAiNote]";

// ── 输出 Schema ────────────────────────────────────────────────────────────

export const EmailAiNoteSchema = z.object({
	headline: z
		.string()
		.describe("1 行短描述，<= 40 字。突出本封邮件最重要的信息（语言跟邮件一致）"),

	keyPoints: z
		.array(z.string())
		.max(6)
		.describe("本封邮件的要点 3-5 条，每条 <= 40 字"),

	namedEntities: z
		.object({
			people: z.array(z.string()).max(8).describe("提到的人名"),
			orgs: z.array(z.string()).max(8).describe("提到的机构/项目名"),
			money: z.array(z.string()).max(8).describe("提到的金额/数字（带单位）"),
			dates: z.array(z.string()).max(8).describe("提到的日期/截止时间"),
		})
		.describe("结构化实体抽取，字段没有就填空数组"),

	delta: z
		.object({
			kind: z
				.enum([
					"first_email",
					"follow_up",
					"new_topic",
					"decision",
					"blocker_added",
					"blocker_resolved",
					"status_update",
					"clarification",
				])
				.describe("本封邮件相对前次的性质"),
			vsPrev: z
				.string()
				.describe(
					"相比上封邮件的变化简述。如果是 first_email 就写「该事项首封邮件」",
				),
			newFacts: z
				.array(z.string())
				.max(5)
				.describe("本封新出现的事实，每条 <= 40 字"),
			changedFacts: z
				.array(
					z.object({
						fact: z.string(),
						from: z.string(),
						to: z.string(),
					}),
				)
				.max(5)
				.describe("已知事实的变更（如：金额从 X 改为 Y）"),
		})
		.describe("Delta 是核心字段，叙事价值最大"),

	actionability: z
		.object({
			hasDecisionPoint: z.boolean().describe("是否需要某个决策"),
			suggestedActions: z
				.array(
					z.object({
						label: z.string().describe("行动短描述，<= 30 字"),
						why: z.string().describe("为什么建议，<= 40 字"),
					}),
				)
				.max(4),
			mentionsDeadline: z
				.string()
				.nullable()
				.describe("如果邮件提到截止日，给 ISO 日期或自由文本；否则 null"),
		})
		.describe("可操作性"),

	importance: z
		.number()
		.int()
		.min(1)
		.max(5)
		.describe("重要性 1-5。参考标准：5=阻塞/重大决策；4=关键状态变化；3=普通进展；2=补充说明；1=寒暄/客套"),

	sentiment: z
		.enum(["positive", "neutral", "concern", "blocker"])
		.describe("情绪/语气信号"),
});

export type EmailAiNote = z.infer<typeof EmailAiNoteSchema>;

// ── 智能触发规则 ──────────────────────────────────────────────────────────

const DECISION_KEYWORDS_EN =
	/\b(approve|reject|decision|deadline|urgent|blocker|confirm|sign[- ]?off|launch|delay|postpon)/i;
const DECISION_KEYWORDS_CN =
	/(决定|批准|否决|通过|驳回|拒绝|截止|期限|阻塞|延期|推迟|确认|签|发布|上线|风险)/;
const HAS_ATTACHMENT_QUERY_LIMIT = 1; // 只要有附件就算"重要"

interface TriggerInput {
	entityId: string;
	threadId: string;
	reason: "inbound_first" | "inbound_merged" | "manual" | "lazy_backfill";
}

/**
 * 智能判定是否需要给这封邮件跑 AI 提炼。
 * 命中任一规则即跑：
 *  - first_email：该 entity 首封邮件（建立基线，必跑）
 *  - has_attachment：邮件含附件
 *  - decision_keywords：包含决策类关键词
 *  - long_email：正文 > 1000 字
 *  - time_gap：距上一封邮件 > 24h
 *  - manual / lazy_backfill：强制跑
 */
export async function triggerEmailAiNoteIfNeeded(input: TriggerInput): Promise<{
	skipped: boolean;
	reason: string;
}> {
	const { entityId, threadId, reason } = input;

	if (reason === "manual" || reason === "lazy_backfill") {
		await analyzeIndividualEmail({ entityId, threadId });
		return { skipped: false, reason };
	}

	const thread = await db.emailThread.findUnique({
		where: { id: threadId },
		select: {
			receivedAt: true,
			bodyText: true,
			snippet: true,
			subject: true,
			_count: { select: { attachments: true } },
		},
	});
	if (!thread) {
		return { skipped: true, reason: "thread_not_found" };
	}

	if (reason === "inbound_first") {
		await analyzeIndividualEmail({ entityId, threadId });
		return { skipped: false, reason: "first_email" };
	}

	const triggers: string[] = [];

	if (thread._count.attachments >= HAS_ATTACHMENT_QUERY_LIMIT) {
		triggers.push("has_attachment");
	}

	const text = `${thread.subject ?? ""}\n${thread.bodyText ?? thread.snippet ?? ""}`;
	if (DECISION_KEYWORDS_EN.test(text) || DECISION_KEYWORDS_CN.test(text)) {
		triggers.push("decision_keywords");
	}

	if ((thread.bodyText?.length ?? 0) > 1000) {
		triggers.push("long_email");
	}

	const prev = await db.emailThread.findFirst({
		where: { entityId, id: { not: threadId } },
		orderBy: { receivedAt: "desc" },
		select: { receivedAt: true },
	});
	if (prev?.receivedAt && thread.receivedAt) {
		const hoursGap =
			(thread.receivedAt.getTime() - prev.receivedAt.getTime()) /
			(1000 * 60 * 60);
		if (hoursGap > 24) {
			triggers.push("time_gap");
		}
	}

	if (triggers.length === 0) {
		console.info(
			`${LOG_TAG} skipped entity=${entityId} thread=${threadId} reason=no_trigger`,
		);
		return { skipped: true, reason: "no_trigger" };
	}

	await analyzeIndividualEmail({ entityId, threadId });
	return { skipped: false, reason: triggers.join(",") };
}

// ── 核心分析 ────────────────────────────────────────────────────────────

interface AnalyzeInput {
	entityId: string;
	threadId: string;
	/** 强制重新分析，忽略已有 ai_note */
	force?: boolean;
}

/**
 * 给单封邮件生成 AI 提炼笔记，写入 timeline event (type=email_ai_note)。
 *
 * 上下文构造：
 *  - 当前邮件正文（截断到 4000 字）
 *  - 同 thread 的附件 OCR 内容（截断到 3000 字）
 *  - 上一封邮件已有的 ai_note keyPoints（用于生成 delta）
 */
export async function analyzeIndividualEmail(input: AnalyzeInput): Promise<{
	created: boolean;
	threadId: string;
	skipped?: string;
}> {
	const { entityId, threadId, force = false } = input;

	// 已有则跳过（除非 force）
	if (!force) {
		const existing = await db.timelineEvent.findFirst({
			where: {
				entityId,
				type: "email_ai_note",
				metadata: { contains: `"threadId":"${threadId}"` },
			},
			select: { id: true },
		});
		if (existing) {
			return { created: false, threadId, skipped: "already_exists" };
		}
	}

	const thread = await db.emailThread.findUnique({
		where: { id: threadId },
		select: {
			id: true,
			subject: true,
			sender: true,
			senderName: true,
			bodyText: true,
			bodyHtml: true,
			snippet: true,
			receivedAt: true,
			organizationId: true,
		},
	});
	if (!thread) {
		return { created: false, threadId, skipped: "thread_not_found" };
	}

	const body =
		thread.bodyText ||
		stripHtmlSimple(thread.bodyHtml ?? "") ||
		thread.snippet ||
		"";

	if (body.trim().length < 30 && !thread.subject) {
		return { created: false, threadId, skipped: "empty" };
	}

	// 找上一封邮件 + 它的 ai_note（如果有），用于生成 delta
	const prev = await db.emailThread.findFirst({
		where: {
			entityId,
			receivedAt: { lt: thread.receivedAt ?? new Date() },
			id: { not: threadId },
		},
		orderBy: { receivedAt: "desc" },
		select: {
			id: true,
			subject: true,
			sender: true,
			senderName: true,
			receivedAt: true,
			snippet: true,
		},
	});

	let prevContext = "";
	if (prev) {
		const prevNote = await db.timelineEvent.findFirst({
			where: {
				entityId,
				type: "email_ai_note",
				metadata: { contains: `"threadId":"${prev.id}"` },
			},
			select: { metadata: true },
		});
		const prevNoteData = parseNoteMetadata(prevNote?.metadata);
		const prevPoints =
			prevNoteData?.keyPoints?.join("; ") ?? prev.snippet ?? "（无前次提炼）";
		prevContext = `[上一封邮件 ${prev.receivedAt?.toISOString()} from ${prev.senderName ?? prev.sender}]
主题：${prev.subject}
要点：${prevPoints}`;
	} else {
		prevContext = "[本封是该事项的第一封邮件，没有前次参考]";
	}

	// 拉本邮件附件内容（如果有）。注意 readEntityAttachments 拉的是该 entity
	// 全部附件，这里我们手动只取本 thread 的附件文本。
	const attachmentText = await readSingleThreadAttachments(threadId);

	const prompt = `你是企业邮件深度分析助手。请基于以下信息，给"本封"邮件生成结构化提炼。

【任务关键】
1. delta.vsPrev 是核心字段——要明确说明"相对上封邮件，本封做了什么/变了什么"。
   如果是月报这类周期性邮件，请对比指标变化（金额、进度、风险）。
2. importance 评分要慎重：5 分留给阻塞/重大决策；3 是普通进展；1-2 是寒暄。
3. 字段空就给空数组/空字符串/null，不要硬编。
4. 用与邮件正文相同的语言（中文邮件用中文输出，英文邮件用英文）。

【前次参考】
${prevContext}

【本封邮件】
时间：${thread.receivedAt?.toISOString()}
发件人：${thread.senderName ?? thread.sender}
主题：${thread.subject}

正文（前 4000 字）：
${body.slice(0, 4000)}

${
	attachmentText
		? `本封附件提取内容（前 3000 字）：
${attachmentText.slice(0, 3000)}`
		: "（本封无附件或附件无法提取文字）"
}`;

	try {
		const note = await safeGenerateObject({
			model: fastModel,
			schema: EmailAiNoteSchema,
			prompt,
		});

		const headline = note.headline.slice(0, 80);

		await db.timelineEvent.create({
			data: {
				entityId,
				type: "email_ai_note",
				content: headline,
				metadata: JSON.stringify({
					threadId,
					...note,
					generatedAt: new Date().toISOString(),
				}),
			},
		});

		console.info(
			`${LOG_TAG} created entity=${entityId} thread=${threadId} importance=${note.importance} kind=${note.delta.kind}`,
		);
		return { created: true, threadId };
	} catch (err) {
		console.error(
			`${LOG_TAG} FAILED entity=${entityId} thread=${threadId}:`,
			err instanceof Error ? err.message : String(err),
		);
		return { created: false, threadId, skipped: "llm_error" };
	}
}

// ── 批量补齐 ────────────────────────────────────────────────────────────

/**
 * 扫描该 entity 所有邮件，给"还没有 email_ai_note"的邮件补跑分析。
 * 详情页打开时调用 / Agent 工具调用。
 *
 * @param entityId
 * @param maxConcurrent 并发数，默认 2（控制 LLM 速率）
 */
export async function analyzeAllPendingEmails(
	entityId: string,
	maxConcurrent = 2,
): Promise<{
	total: number;
	analyzed: number;
	skipped: number;
	failures: number;
}> {
	const threads = await db.emailThread.findMany({
		where: { entityId },
		orderBy: { receivedAt: "asc" }, // 顺序跑，delta 才有意义
		select: { id: true },
	});

	if (threads.length === 0) {
		return { total: 0, analyzed: 0, skipped: 0, failures: 0 };
	}

	// 一次性查出已有 ai_note 的 threadId 集合
	const existingNotes = await db.timelineEvent.findMany({
		where: { entityId, type: "email_ai_note" },
		select: { metadata: true },
	});
	const existingThreadIds = new Set(
		existingNotes
			.map((n) => parseNoteMetadata(n.metadata)?.threadId)
			.filter((id): id is string => !!id),
	);

	const pending = threads.filter((t) => !existingThreadIds.has(t.id));

	if (pending.length === 0) {
		return {
			total: threads.length,
			analyzed: 0,
			skipped: threads.length,
			failures: 0,
		};
	}

	let analyzed = 0;
	let failures = 0;

	// 顺序跑（保证 delta 有正确前置参考）
	// maxConcurrent 当前未使用，保留为未来优化空间（小批量并发）
	void maxConcurrent;
	for (const t of pending) {
		try {
			const r = await analyzeIndividualEmail({ entityId, threadId: t.id });
			if (r.created) {
				analyzed += 1;
			}
		} catch (err) {
			failures += 1;
			console.warn(
				`${LOG_TAG} batch failure entity=${entityId} thread=${t.id}:`,
				err instanceof Error ? err.message : String(err),
			);
		}
	}

	return {
		total: threads.length,
		analyzed,
		skipped: threads.length - pending.length,
		failures,
	};
}

// ── 整体叙事重生成 ──────────────────────────────────────────────────────

/**
 * 基于该 entity 所有 email_ai_note，重新合成"项目级叙事摘要"，写入 entity.aiSummary。
 *
 * 用于解决：合并/分类变更后整体 ai_summary 没刷新的问题。
 */
export async function regenerateEntityNarrative(entityId: string): Promise<{
	updated: boolean;
	noteCount: number;
	summary?: string;
}> {
	const entity = await db.flowEntity.findUnique({
		where: { id: entityId },
		select: { id: true, title: true, organizationId: true },
	});
	if (!entity) {
		throw new Error(`entity ${entityId} not found`);
	}

	const notes = await db.timelineEvent.findMany({
		where: { entityId, type: "email_ai_note" },
		orderBy: { createdAt: "asc" },
		select: { content: true, metadata: true, createdAt: true },
	});

	if (notes.length === 0) {
		return { updated: false, noteCount: 0 };
	}

	const noteSummaries = notes
		.map((n, idx) => {
			const data = parseNoteMetadata(n.metadata);
			if (!data) {
				return `${idx + 1}. ${n.content}`;
			}
			return `${idx + 1}. [${data.delta?.kind ?? "?"} 重要性${data.importance ?? "?"}] ${data.headline ?? n.content}
   要点：${(data.keyPoints ?? []).slice(0, 3).join("；")}
   变化：${data.delta?.vsPrev ?? "(无)"}`;
		})
		.join("\n");

	const { text } = await generateText({
		model: textModel,
		prompt: `你是企业邮件项目分析师。基于以下"逐封邮件提炼"，给该事项写一份简洁的项目级叙事摘要。

要求：
- 200-400 字
- 用与原邮件相同的语言
- 包含：当前进展、关键里程碑、悬而未决的决策点、明显风险
- 不要罗列每封邮件，要做"故事化"的整合

事项标题：${entity.title}

逐封邮件提炼（按时间序）：
${noteSummaries}`,
	});

	const summary = text.trim();

	await db.flowEntity.update({
		where: { id: entityId },
		data: { aiSummary: summary, updatedAt: new Date() },
	});

	await db.timelineEvent.create({
		data: {
			entityId,
			type: "narrative_refreshed",
			content: `AI 重新合成项目叙事（基于 ${notes.length} 条邮件提炼）`,
			metadata: JSON.stringify({
				noteCount: notes.length,
				generatedAt: new Date().toISOString(),
			}),
		},
	});

	console.info(
		`${LOG_TAG} narrative refreshed entity=${entityId} noteCount=${notes.length}`,
	);
	return { updated: true, noteCount: notes.length, summary };
}

// ── helpers ────────────────────────────────────────────────────────────

async function readSingleThreadAttachments(threadId: string): Promise<string> {
	const thread = await db.emailThread.findUnique({
		where: { id: threadId },
		select: { entityId: true },
	});
	if (!thread?.entityId) {
		return "";
	}

	// MVP：直接复用 entity 级附件读取（含全部 thread 附件）。
	// 后续可拆分成 per-thread 版本节省读取。
	try {
		const result = await readEntityAttachments(thread.entityId, 6000);
		return result.text;
	} catch {
		return "";
	}
}

interface ParsedNote {
	threadId?: string;
	headline?: string;
	keyPoints?: string[];
	importance?: number;
	delta?: { kind?: string; vsPrev?: string };
}

function parseNoteMetadata(metadata: string | null | undefined): ParsedNote | null {
	if (!metadata) {
		return null;
	}
	try {
		return JSON.parse(metadata) as ParsedNote;
	} catch {
		return null;
	}
}

function stripHtmlSimple(html: string): string {
	return html
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/\s+/g, " ")
		.trim();
}
