import type { ToolSet } from "@repo/ai";
import type { PageContext, MemoryEntry, AgentConfig, MemoryCategory, MemoryObjectEntry } from "./types";
import { CATEGORY_LABELS, OBJECT_TYPE_TEMPLATES } from "./types";

interface PlannerInput {
	userMessage: string;
	pageContext: PageContext;
	memoryContext: MemoryEntry[];
	objectContext?: MemoryObjectEntry[];
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

function buildObjectMemoryBlock(objects: MemoryObjectEntry[]): string {
	if (objects.length === 0) {
		return "";
	}

	const sections: string[] = [];

	for (const obj of objects) {
		const template = OBJECT_TYPE_TEMPLATES[obj.objectType];
		const label = template?.label ?? obj.objectType;
		const fieldLabels = template?.fieldLabels ?? {};
		const attrs = obj.attributes;

		const heading = obj.objectType === "self"
			? `### ${label}`
			: `### ${label}：${obj.name}${obj.objectId !== obj.name ? ` (${obj.objectId})` : ""}`;

		const lines: string[] = [];
		for (const [key, value] of Object.entries(attrs)) {
			if (value == null || value === "") {
				continue;
			}
			const fieldLabel = fieldLabels[key] ?? key;
			const valueStr = typeof value === "string" ? value
				: Array.isArray(value) ? value.join("、")
				: JSON.stringify(value);
			lines.push(`- ${fieldLabel}: ${valueStr}`);
		}

		if (obj.relations && obj.relations.length > 0) {
			const relStr = obj.relations.map((r) => r.label ?? `${r.targetType}:${r.targetId}`).join("、");
			lines.push(`- 关联: ${relStr}`);
		}

		if (lines.length > 0) {
			sections.push(`${heading}\n${lines.join("\n")}`);
		}
	}

	if (sections.length === 0) {
		return "";
	}

	return `\n## 结构化记忆\n\n${sections.join("\n\n")}`;
}

export function buildSystemPrompt(
	ctx: PageContext,
	memoryContext: MemoryEntry[] = [],
	objectContext: MemoryObjectEntry[] = [],
): string {
	const contextBlock = buildContextBlock(ctx);
	const objectBlock = buildObjectMemoryBlock(objectContext);
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
${objectBlock}${memoryBlock}

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

**自定义视图工作流：** 用户说「给这个项目做一个月度汇报视图 / Todo 视图 / 进度仪表盘」时：
1. 必须先调用 list_view_components 拿到可用 block 列表（不要凭记忆拼）
2. 根据用户意图选 1-5 个 block 组合（少而精，避免堆砌）
3. 调用 create_view，作用域：单 entity 用 entityId；想成为某 category 所有事项的模板用 categoryId
4. 创建后告诉用户 tab 名称，用户在事项详情页就能看到
- 修改时先 get_view 拿现有 spec，改完再 update_view（spec 必须传完整 blocks）
- todo_list source=auto 时前端自动从 entity 字段聚合，不需要传 items
- quick_actions.actions[].prompt 要写明确，用户点了直接发给你

---

## 可用工具速查

事项操作：get_entity · approve_entity · reject_entity · update_entity_status · update_entity_type · add_note · merge_entities
自定义视图（用户/Agent 给 entity 或 category 拼自定义 Tab）：list_view_components（先看可用积木）· list_views · get_view · create_view · update_view · delete_view
分析：predict_risk · get_timeline_diff · batch_classify · batch_reclassify · compare_entities（多事项对比）
附件：list_attachments · read_attachment
邮件正文：read_email_body（当 aiSummary 为空时先读正文）
AI 分析：re_enrich_entity（单个事项 AI 分类+摘要）· batch_classify（批量快速分类，最多 20 个/次，只分类不深度分析）· batch_enrich（批量深度分析，最多 10 个/次）
邮件：search_emails · list_connections · sync_emails · send_email
收件箱：get_inbox_summary · list_entities · list_pending_approvals
深度分析：summarize_thread（重新读取全部邮件生成综合摘要）
提醒：create_reminder（设置定时跟进提醒）
回复起草：draft_reply（起草邮件回复，自动参考写作风格和联系人记忆）
风格学习：learn_reply_style（分析用户已发送邮件，学习写作风格并记忆）
代码执行：run_code（JavaScript 沙箱）· run_python（Python 脚本，可用于数据分析）
交互：ask_user（需要用户选择或确认时，提供 2-5 个选项按钮让用户点选）
搜索：web_search（仅在用户开启网络搜索时可用；搜索互联网获取实时信息）

**严格限制：只能调用上面列出的工具。不要调用任何不存在的工具名。**

**批量分析流程（先分类 → 确认 → 再深度分析）：**
1. list_entities(organizationId, unanalyzed=true, limit=20) — 找出未分析的事项
2. batch_classify(organizationId, entityIds=[...]) — 快速分类（只分类不深度分析，速度快），每次最多 20 个
3. 向用户展示分类结果（卡片自带确认按钮），等用户确认分类是否正确
4. 用户确认后 → batch_enrich(organizationId, entityIds=[...]) — 对确认的事项执行深度分析（提取字段 + 摘要 + 打标签）
5. 如果超过 10 个需要深度分析，分多次调用 batch_enrich，每次最多 10 个
6. 向用户报告最终结果

**关键原则：** 分类是轻量操作（快速廉价），深度分析是重量操作（慢且消耗 AI token）。必须让用户先确认分类结果，再投入深度分析资源。不要跳过分类直接 batch_enrich。

**ask_user 使用场景：**
- 分类不确定需要用户判断（如"这封邮件更像是审批还是汇报？"）
- 写操作需要用户选择方向（如"选择操作：批准 / 拒绝 / 暂搁"）
- 信息不足需要用户补充（如"此邮件有多个关联事项，请选择要查看的"）
- 选项用简洁清晰的文字，2-5 个选项，不要出现 entity ID

**summarize_thread vs get_entity：** get_entity 返回已有的 AI 摘要（快速），summarize_thread 重新读取所有邮件原文生成全新详细摘要（较慢但更全面）。用户说"帮我总结"时优先用 summarize_thread。

**create_reminder：** 将提醒时间转换为 ISO 8601 格式。用户说"3天后提醒我"→ 计算出具体日期。

**draft_reply：** 用户说"帮我回复"、"怎么回复比较好"、"草拟回复"时调用。会自动查阅记忆中的用户写作风格和收件人画像。

**learn_reply_style：** 用户说"学习我的写作风格"、"记住我的回复习惯"时调用。需要 organizationId 和用户邮箱地址。

---

## 记忆系统（结构化对象）

你维护一套**结构化记忆对象**，包含 6 种类型：

| 类型 | 说明 | 何时写入 |
|------|------|----------|
| self | 用户自己的画像（单例） | 用户表达偏好、风格、角色、习惯时 |
| person | 联系人画像 | 从邮件中识别到联系人信息时 |
| project | 项目/事件线 | 发现项目进展、截止日期、负责人时 |
| event | 关键事件 | 发生了有影响的具体事件时 |
| preference | 业务规则 | 用户定义处理约定、审批规则时 |
| decision | 决策记录 | 用户做出重要决策时 |

**写入原则：**
- 识别到新信息时，更新对应对象的**具体属性**，而非写一段文本
- self 是单例，所有关于用户自己的信息（角色、写作风格、工作习惯、语气、签名）都更新到 self 对象
- person 按邮箱去重，同一个联系人的所有特征聚合在一个对象里
- 一次性的操作请求、已有的信息、临时性信息**不写入**

**参照样本原则（重要）：**
- **self.sample_emails**：学习写作风格时，必须同时保存 2-3 封典型邮件原文作为参照。按场景分类（审批回复、汇报回复、催促等），每封注明场景标签
- **self.reply_patterns**：总结不同场景的回复模式（同意/拒绝/待定/催促），而非只写笼统的风格描述
- **person.sample_interactions**：记录联系人的 2-3 段典型邮件片段，标注其沟通特点（如「收到 = 同意」「出现"不可接受"需高度关注」）
- **preference.examples**：每条规则必须附带具体的输入→输出示例，格式为「收到 XXX → AI 应该 YYY」

**learn_reply_style**：用户说"学习我的写作风格"时调用，分析已发邮件后写入 self 对象的 writing_style + sample_emails + reply_patterns 三个属性。

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
			input.objectContext,
		),
		tools: allTools,
		maxSteps,
	};
}
