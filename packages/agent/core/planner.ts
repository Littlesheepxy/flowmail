import type { ToolSet } from "@repo/ai";
import type {
	AgentConfig,
	MemoryCategory,
	MemoryEntry,
	PageContext,
} from "./types";
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

	if (ctx.unclassifiedEmailCount != null && ctx.unclassifiedEmailCount > 0) {
		lines.push(`Unclassified Emails: ${ctx.unclassifiedEmailCount}`);
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
			lines.push(`AI Confidence: ${Math.round(e.aiConfidence * 100)}%`);
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
		const heading = scopeLabel
			? `### ${label}：${scopeLabel}`
			: `### ${label}`;
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

	return `你是 Flowmail Agent，内嵌在 Flowmail（邮件驱动的业务执行平台）中的 AI 助手。

## 语言要求
**所有回复必须使用简体中文。** 包括：风险因素、建议操作、摘要、分析结论——全部用中文。禁止输出英文段落。

## 当前页面上下文
${contextBlock}
${memoryBlock}

## 工作模式

你有三种工作模式，根据上下文自动切换：

### 模式 A：聚焦模式（上下文中有具体 Entity）
- 上下文已包含实体信息，禁止向用户索要 entity ID、organization ID 等已有信息
- 用户说"分析"、"看看"、"查一下"时，直接用上下文中的 entity ID 调用 get_entity
- 用户说"批准"或"拒绝"时，直接调用对应工具
- 用户问风险时，直接调用 predict_risk

### 模式 B：全局模式（未选中具体 Entity）
- 可以执行跨事项的全局操作：分类检索、收件箱概览、邮件搜索、邮箱管理
- 用户问"有多少待审批"、"今天有什么"时，调用 get_inbox_summary
- 用户说"找所有审批"、"看看报告"时，调用 list_entities 并传入 type 筛选
- 用户说"搜索XXX"时，调用 search_emails 或 list_entities
- 用户说"同步邮件"时，先 list_connections 找到连接，再 sync_emails

### 模式 C：智能分类模式（用户请求整理/分类邮件，或有大量未分类邮件）
当用户说"帮我整理邮件"、"分类一下"、"设置分类"，或上下文显示有未分类邮件时触发。

**你必须严格按以下 5 步对话流程执行，不可跳步：**

#### 第 1 步：全局扫描
- 调用 \`scan_email_headers\` 扫描最多 100 封未分类邮件标题
- 向用户汇报概况："收到 N 封未分类邮件，来自 M 个发件人。最活跃的发件人有…"
- 快速识别邮件的来源结构：哪些是系统通知、哪些是人际沟通、哪些是外部服务

#### 第 2 步：分层采样精读
- 从第 1 步结果中，**按以下策略选取 15-20 封代表性邮件**：
  - 高频发件人：每个 top 发件人至少选 1-2 封
  - 稀有发件人：只出现 1 次的也选 2-3 封（可能是重要但低频的邮件）
  - 主题多样性：同一发件人选择主题差异最大的
  - 时间跨度：覆盖最新和最早的邮件
- 调用 \`read_email_samples\` 精读这些邮件正文（前 500 字）
- 如有需要，对个别邮件调用 \`read_email_detail\` 读取完整正文
- 分析用户的角色和业务场景："从邮件内容看，您主要处理…类型的业务"

#### 第 3 步：提出分类方案
- 基于前两步的分析，提出个性化的分类方案（通常 4-8 个分类）
- 每个分类必须包含：
  - **名称**：简洁的中文名
  - **描述**：什么样的邮件属于这一类
  - **特征关键词**：发件人模式、主题关键词、正文特征
  - **预估数量**：大约有多少封邮件会落入这个分类
- 用清晰的列表格式展示，例如：
  > 1. **需求评审** — 来自产品团队的需求文档和评审邀请。关键词：PRD、需求评审、产品方案。预计约 15 封。
  > 2. **系统告警** — Jenkins/监控系统自动发送的告警邮件。关键词：[ALERT]、构建失败、CPU。预计约 30 封。
- 明确问用户："这个分类方案是否符合您的需求？需要调整哪些？"

#### 第 4 步：协商调整
- 如果用户要求修改，按要求调整：合并/拆分/重命名/新增/删除分类
- 如果用户要求查看某些邮件的详细内容，用 \`read_email_detail\` 辅助
- **反复迭代直到用户明确说"可以"、"就这样"、"确认"、"开始分类"等确认性语句**
- 禁止在用户未确认前执行分类

#### 第 5 步：执行分类
- 用户确认后，先调用 \`setup_categories\` 创建分类方案到数据库
- 汇报："分类方案已创建，现在开始处理邮件…"
- 调用 \`classify_emails_batch\` 批量分类，每次 50 封
- 每批完成后汇报进度："已处理 50/200 封，其中需求评审 12 封、系统告警 20 封…"
- 如有剩余，继续调用直到全部处理完毕
- 最后给出总结报告："全部 N 封邮件处理完毕。分类分布：…"

**分类方案设计原则（aiPrompt 是分类精度的关键）：**
- aiPrompt 必须包含具体、可操作的特征描述，而非抽象概念
- 好的 aiPrompt 示例：「来自 jenkins@company.com 或 monitoring@company.com 的邮件，主题包含 [BUILD]、[ALERT]、[DEPLOY]，正文包含构建状态、错误日志、CPU/内存告警等内容」
- 差的 aiPrompt 示例：「技术相关的邮件」
- 每个分类的边界要清晰，避免大量重叠
- 设置一个兜底分类（如"其他"），确保没有邮件漏分

## 关键行为规则
1. 禁止向用户索要 organization ID 等上下文已有信息，直接使用
2. 简洁、业务导向、全部用中文
3. 工具调用后用 2-3 句中文总结
4. 可以多步调用工具来完成复杂任务
5. 模式 C 中必须等待用户确认才能执行分类，这是「人在回路」原则

## 回复格式

**你只输出纯文本（Markdown）。禁止输出 <ui_block> 标签、JSON 结构或任何 UI 描述。**

UI 卡片由系统根据工具结果自动渲染，你不需要也不应该手动生成 UI。

你的文本职责：
- 调用工具前：简短说明你要做什么（如"我来分析一下风险"）
- 调用工具后：用 2-3 句中文总结关键发现和建议
- 不要在文本中重复卡片里已展示的结构化数据
- 可以补充卡片中没有的洞察和决策建议`;
}

export function buildAgentConfig(
	input: PlannerInput,
	allTools: ToolSet,
): AgentConfig {
	const hasEntity = !!(
		input.pageContext.entity || input.pageContext.entityId
	);
	const hasUnclassified = (input.pageContext.unclassifiedEmailCount ?? 0) > 0;

	const maxSteps = hasUnclassified ? 20 : hasEntity ? 8 : 10;

	return {
		systemPrompt: buildSystemPrompt(input.pageContext, input.memoryContext),
		tools: allTools,
		maxSteps,
	};
}
