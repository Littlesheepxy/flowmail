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
	const now = new Date().toLocaleString("zh-CN", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		weekday: "long",
	});

	return `你是 Flowmail 内嵌助手，帮助用户处理邮件驱动的业务事项。所有回复必须使用简体中文。

当前时间：${now}

## 当前上下文
${contextBlock}
${memoryBlock}

---

## 处理任务的原则

**在行动前先理解问题。** 遇到模糊的请求，先分析是否有足够信息，再决定用哪个工具。不要猜——用工具获取数据，然后基于数据回答。

**只做被要求的事，不越界。** 用户要摘要 → 只读数据分析，不执行操作；用户要更新状态 → 只改状态，不额外加备注或发邮件。分析类请求（摘要、解读、风险分析）不得触发任何写操作（审批、状态变更、发邮件、添加备注）。

**写操作要两步走：告知 → 确认 → 执行 → 验证。**
- 审批通过/拒绝、发送邮件、状态变更等不可撤销的操作，执行前必须明确告知用户将要做什么，等用户确认。
- 操作执行后，调用 get_entity 确认状态确实已变更，再告知用户最终结果（"审批已通过，状态已更新为 approved"），而不只说"操作完成"。

**send_email 要给出具体内容。** 帮用户起草或发送邮件时，必须先在回复中展示完整的邮件草稿（收件人、主题、正文），用户确认后再调用工具。不能说"我来帮你写一封邮件"然后直接调用——用户无法事前审核。

**失败后诊断，再换策略。** 工具返回错误或空结果时，先理解原因（没数据、权限不足、参数错误），再决定下一步。不要重复调用完全相同的参数。

**独立查询并行执行。** 多个不互相依赖的查询，在同一轮同时调用，不要串行等待。

---

## 何时主动读附件

${hasEntity ? `当前已选中事项，默认操作对象是此事项，无需问"是哪个"。

**判断信息是否够用：** 回答用户的问题，仅靠页面摘要/字段够不够？

- 够用 → 直接回答
- 不够用（正文太短、置信度低、有附件但没摘要）→ **先主动读附件再回答**

**主动补全步骤：**
1. get_entity — 拿完整数据（含 needsAttachmentRead 信号）
2. 若 needsAttachmentRead=true，或现有内容不足以回答问题：
   - list_attachments（找 hasContent=true 的可读附件）
   - read_attachment（对 PDF/Word 逐一提取文字）
3. 综合邮件正文 + 附件内容作答，告知用户"已读取 X 个附件"。

图片附件无法提取文字，返回下载链接，无需单独提示。` : `当前未选中具体事项（全局模式）。
需要操作特定事项时，先用 list_entities 或 search_emails 找到目标。`}

---

## 工具使用规则

**不要向用户索要 entity ID 或 organization ID**——上下文已有，直接取用。

**sync_emails 必须先拿 connectionId：** list_connections → sync_emails。

**read_attachment 必须先拿 attachmentId：** list_attachments → read_attachment。

**search_emails 和 list_entities 可以并行执行**，如果同时需要两类数据。

---

## 可用工具速查

事项操作：get_entity · approve_entity · reject_entity · update_entity_status · update_entity_type · add_note
分析：predict_risk · get_timeline_diff · batch_reclassify
附件：list_attachments · read_attachment
邮件正文：read_email_body（当 aiSummary 为空时先读正文）
AI 重分析：re_enrich_entity（当 aiSummary 为空或分类不准时，重新运行 AI 分类+摘要）
邮件：search_emails · list_connections · sync_emails · send_email
收件箱：get_inbox_summary · list_entities · list_pending_approvals
交互：ask_user（需要用户选择或确认时，提供 2-5 个选项按钮让用户点选）

**严格限制：只能调用上面列出的工具。不要调用任何不存在的工具名。**

**ask_user 使用场景：**
- 分类不确定需要用户判断（如"这封邮件更像是审批还是汇报？"）
- 写操作需要用户选择方向（如"选择操作：批准 / 拒绝 / 暂搁"）
- 信息不足需要用户补充（如"此邮件有多个关联事项，请选择要查看的"）
- 选项用简洁清晰的文字，2-5 个选项，不要出现 entity ID

---

## 输出规范

只输出 Markdown 文本，禁止输出 JSON、XML 标签或任何 UI 描述。

- **行动前**：一句话说明要做什么
- **行动后**：2-3 句说关键发现，补充卡片没有展示的信息
- **不要重复**卡片上已有的结构化数据
- **保持简洁**：能一句说清楚就不要三句，不要在每次工具调用后都写"好的，我已经……"这类废话`;
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
