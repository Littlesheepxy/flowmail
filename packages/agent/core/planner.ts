import type { ToolSet } from "@repo/ai";
import type { PageContext, MemoryEntry, AgentConfig, MemoryCategory } from "./types";
import { CATEGORY_LABELS } from "./types";

interface PlannerInput {
	userMessage: string;
	pageContext: PageContext;
	memoryContext: MemoryEntry[];
}

function buildContextBlock(ctx: PageContext): string {
	const lines: string[] = [];

	if (ctx.route) {
		lines.push(`Page: ${ctx.route}`);
	}
	if (ctx.organizationId) {
		lines.push(`Organization: ${ctx.organizationId}`);
	}

	if (ctx.entity) {
		const e = ctx.entity;
		lines.push(
			`Entity: "${e.title}" (${e.type}, status: ${e.status}, id: ${e.id})`,
		);
		if (e.aiSummary) {
			lines.push(`AI Summary: ${e.aiSummary}`);
		}
		if (e.aiConfidence != null) {
			lines.push(
				`AI Confidence: ${Math.round(e.aiConfidence * 100)}%`,
			);
		}
		if (e.extractedFields && Object.keys(e.extractedFields).length > 0) {
			lines.push(
				`Extracted Fields: ${JSON.stringify(e.extractedFields)}`,
			);
		}
	} else if (ctx.entityId) {
		lines.push(`Entity ID: ${ctx.entityId}`);
	}

	if (ctx.timelinePreview && ctx.timelinePreview.length > 0) {
		lines.push("Recent Timeline:");
		for (const ev of ctx.timelinePreview) {
			lines.push(`  [${ev.createdAt}] ${ev.type}: ${ev.content}`);
		}
	}

	if (ctx.activeFilters) {
		const parts = Object.entries(ctx.activeFilters)
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}=${v}`);
		if (parts.length > 0) {
			lines.push(`Active Filters: ${parts.join(", ")}`);
		}
	}

	if (lines.length > 0) {
		return lines.join("\n");
	}
	return "当前无特定上下文，用户尚未选择具体事项。";
}

function buildMemoryBlock(entries: MemoryEntry[]): string {
	if (entries.length === 0) {
		return "";
	}

	const grouped = new Map<MemoryCategory, MemoryEntry[]>();
	for (const entry of entries) {
		const cat = entry.category;
		const list = grouped.get(cat) ?? [];
		list.push(entry);
		grouped.set(cat, list);
	}

	const sections: string[] = [];

	for (const [category, items] of grouped) {
		const label = CATEGORY_LABELS[category] ?? category;
		const scopeLabel = buildScopeLabel(items);
		const heading = scopeLabel ? `### ${label}：${scopeLabel}` : `### ${label}`;
		const lines = items.map((e) => `- ${e.content}`);
		sections.push(`${heading}\n${lines.join("\n")}`);
	}

	return `\n## 记忆上下文\n\n${sections.join("\n\n")}`;
}

function buildScopeLabel(items: MemoryEntry[]): string {
	const scoped = items.filter((i) => i.scopeId);
	if (scoped.length === 0) {
		return "";
	}
	const ids = [...new Set(scoped.map((i) => i.scopeId))];
	if (ids.length === 1) {
		return ids[0] ?? "";
	}
	return "";
}

export function buildSystemPrompt(
	ctx: PageContext,
	memoryContext: MemoryEntry[] = [],
): string {
	const contextBlock = buildContextBlock(ctx);
	const memoryBlock = buildMemoryBlock(memoryContext);
	const hasEntity = !!(ctx.entity || ctx.entityId);

	return `你是 Flowmail 内嵌助手，帮助用户处理邮件驱动的业务事项。所有回复必须使用简体中文。

## 当前上下文
${contextBlock}
${memoryBlock}

---

## 处理任务的原则

**在行动前先理解问题。** 遇到模糊的请求，先分析是否有足够信息，再决定用哪个工具。不要猜——用工具获取数据，然后基于数据回答。

**不要做多余的事。** 用户要状态更新，就只更新状态；不要额外加备注、发邮件、或重新分类。用户只要摘要，不要主动执行操作。每个操作只做被要求的那件事。

**操作有风险，先确认。** 审批通过/拒绝、发送邮件等不可撤销的操作，执行前必须告知用户将要做什么，等用户确认后再执行。查询类操作（读数据、分析）可直接执行。

**失败后诊断，再换策略。** 工具返回错误或空结果时，先理解为什么——是没数据、权限不足、还是参数错了——再决定下一步。不要重复调用完全相同的参数。

**并行效率。** 多个不依赖彼此的查询，同时调用，不要串行等待。

---

## 何时主动读附件

${hasEntity ? `当前已选中事项，默认操作对象是此事项，无需问"是哪个"。

**判断信息是否够用的标准：** 回答用户的问题，仅靠页面上的摘要/字段够不够？

- 够用 → 直接回答，不需要读附件
- 不够用（正文内容太短、AI 置信度低、有附件但没摘要）→ **先主动读附件**，再回答

**主动补全的步骤：**
1. get_entity — 拿完整数据（含 needsAttachmentRead 信号）
2. 若 needsAttachmentRead=true，或判断现有内容不足以回答问题：
   - list_attachments（找到可读附件，hasContent=true）
   - read_attachment（对 PDF/Word 逐一提取文字）
3. 综合邮件正文 + 附件内容作答，告知用户："已读取 X 个附件，以下是分析…"

图片附件无法提取文字，返回下载链接，无需单独提示。` : `当前未选中具体事项（全局模式）。
需要操作特定事项时，先用 list_entities 或 search_emails 找到目标。`}

---

## 工具使用规则

**不要向用户索要 entity ID 或 organization ID**——上下文已有，直接取用。

**sync_emails 必须先拿 connectionId：** list_connections → sync_emails。不要猜 connectionId。

**read_attachment 必须先拿 attachmentId：** list_attachments → read_attachment。

**search_emails 和 list_entities 可以并行执行**，如果同时需要两类数据。

---

## 可用工具速查

事项操作：get_entity · approve_entity · reject_entity · update_entity_status · update_entity_type · add_note
分析：predict_risk · get_timeline_diff · batch_reclassify
附件：list_attachments · read_attachment
邮件：search_emails · list_connections · sync_emails · send_email
收件箱：get_inbox_summary · list_entities · list_pending_approvals

---

## 输出规范

只输出 Markdown 文本，禁止输出 JSON、XML 标签或任何 UI 描述。

- **行动前**：一句话说明要做什么（"我来查一下这个事项的详情。"）
- **行动后**：2-3 句说关键发现，补充卡片没展示的信息
- **不要重复**卡片上已有的结构化数据
- **保持简洁**：能一句说清楚就不要三句。不要在每次工具调用后都写"好的，我已经……"这类废话`;
}

export function buildAgentConfig(
	input: PlannerInput,
	allTools: ToolSet,
): AgentConfig {
	const hasEntity = !!(input.pageContext.entity || input.pageContext.entityId);

	const maxSteps = hasEntity ? 8 : 10;

	return {
		systemPrompt: buildSystemPrompt(
			input.pageContext,
			input.memoryContext,
		),
		tools: allTools,
		maxSteps,
	};
}
