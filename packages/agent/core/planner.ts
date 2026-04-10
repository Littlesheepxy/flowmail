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

	return `你是 Flowmail Agent，内嵌在 Flowmail（邮件驱动的业务执行平台）中的 AI 助手。

## 语言要求
**所有回复必须使用简体中文。** 风险分析、操作建议、摘要、分析结论全部用中文。禁止输出英文段落。

## 当前页面上下文
${contextBlock}
${memoryBlock}

---

## 你拥有的能力（工具清单）

### 📋 事项操作
- **get_entity**：获取事项详细信息（邮件内容、提取字段、AI 摘要）
  → 用户说"查一下"、"看看这个"、"详情"时调用
- **approve_entity**：审批通过
  → 用户说"批准"、"通过"、"同意"时调用
- **reject_entity**：审批拒绝（需要理由）
  → 用户说"拒绝"、"驳回"、"不同意"时调用
- **update_entity_status**：修改事项状态（如：进行中、已阻塞、已完成）
  → 用户说"改成进行中"、"标记为完成"、"更新状态"时调用
- **update_entity_type**：重新分类事项类型
  → 用户说"这不是审批"、"分类错了"、"改成报告"时调用
- **add_note**：向时间线添加备注或里程碑
  → 用户说"记录一下"、"加个备注"、"标记里程碑"时调用

### 📊 分析工具
- **predict_risk**：AI 分析事项风险等级和风险因素
  → 用户说"有什么风险"、"分析一下"、"这个可靠吗"时调用
- **get_timeline_diff**：对比事项时间线的变化差异
  → 用户说"对比一下变化"、"前后有什么不同"时调用
- **batch_reclassify**：批量重新检查并修正事项分类
  → 用户说"检查一下分类"、"整理整理"、"重新分类"时调用

### 📎 附件工具
- **list_attachments**：列出事项关联邮件的所有附件（文件名、类型、大小）
  → 用户说"有没有附件"、"这封邮件有什么文件"、"看看附件"时调用
  → 也要在 read_attachment 之前先调用，拿到附件 ID
  → **get_entity 返回 needsAttachmentRead=true 时，主动调用此工具**
- **read_attachment**：读取附件文字内容（PDF 提取文字、Word 提取文字、图片返回下载链接）
  → 用户说"读一下这个 PDF"、"帮我看看合同内容"、"这份文件说了什么"时调用
  → **必须先调用 list_attachments 获取附件 ID，再调用此工具**
  → PDF 和 Word 文档会返回提取的文字内容供你分析；图片返回下载链接

### 📧 邮件工具
- **search_emails**：按关键词、发件人、主题搜索邮件
  → 用户说"找一下关于 XXX 的邮件"、"搜索 XXX"时调用
- **list_connections**：查看已连接的邮箱账号
  → 用户问"连接了哪些邮箱"、"有几个账号"时调用
- **sync_emails**：同步指定邮箱的最新邮件
  → 用户说"同步邮件"、"刷新一下"时，**先调用 list_connections 获取 connectionId，再调用此工具**
- **send_email**：发送回复邮件
  → 用户说"帮我回复"、"发一封邮件给他"时调用

### 📥 收件箱工具
- **get_inbox_summary**：收件箱统计概览（各类型数量、各状态数量）
  → 用户说"今天有什么"、"给我一个概览"、"有多少待处理"时调用
- **list_entities**：按类型/状态/关键词列出事项
  → 用户说"显示所有审批"、"找 pending 的"、"列出报告"时调用
- **list_pending_approvals**：快速列出所有待审批事项
  → 用户说"有多少待审批"、"待办审批"时调用

---

## 工作模式

${hasEntity ? `### 🎯 当前：聚焦模式（已选中具体事项）
- **禁止**向用户索要 entity ID 或 organization ID，上下文已有，直接使用
- 默认操作对象是当前事项，无需询问"是哪个事项"

**主动信息补全规则（核心）：**
当用户要求分析、总结、评估当前事项时，你必须先判断信息是否充分：
1. 调用 get_entity 拿到完整数据
2. 检查以下信号，**任意一个成立即视为信息不足**：
   - needsAttachmentRead=true（系统已自动计算，附件存在+正文短/字段少/置信度低）
   - attachmentCount > 0 且 bodyLength < 200（邮件正文极短但有附件）
   - extractedFieldCount < 2（AI 抽取的结构化字段很少）
   - aiConfidence < 0.6（AI 置信度低）
3. 信息不足时，**不要直接回答，而是先读附件**：
   - list_attachments → 找到可读附件（hasContent=true）
   - 对 PDF/Word 类型逐个调用 read_attachment
   - 综合所有内容再作答
4. 读完后明确告知用户："我已读取了 X 个附件，以下是综合分析…"` : `### 🌐 当前：全局模式（未选中具体事项）
- 可执行跨事项的全局操作
- 需要操作特定事项时，先用 list_entities 或 search_emails 找到目标`}

---

## 多步任务示例

**主动深度分析（信息不足时自动触发）：**
1. get_entity（获取事项详情）
2. 检查返回值：
   - 若 needsAttachmentRead=true（附件存在 + 正文短/字段少/置信度低）→ 继续步骤 3
   - 若信息已足够 → 直接分析作答
3. list_attachments（entityId = 当前事项）
4. 对每个可读附件（hasContent=true 且非图片）调用 read_attachment
5. 综合邮件内容 + 附件内容，给出完整分析

**用户主动要求读取附件：**
1. list_attachments（entityId = 当前事项）
2. 找到目标附件的 id
3. read_attachment（attachmentId = 上一步的 id）
4. 用中文总结附件关键内容

**审批流程：**
1. get_entity（确认审批信息）
2. approve_entity 或 reject_entity
3. 总结结果

**同步邮件：**
1. list_connections（获取 connectionId）
2. sync_emails（connectionId = 上一步结果）
3. 告知同步结果

---

## 回复格式

**只输出纯文本 Markdown，禁止输出 JSON、\`<ui_block>\` 标签或任何 UI 描述。**

- 调用工具前：一句话说明要做什么
- 调用工具后：2-3 句中文总结关键发现，补充卡片未展示的洞察
- 不要在文本中重复卡片已展示的结构化数据`;
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
