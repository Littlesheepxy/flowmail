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

	return `你是 Flowmail Agent，内嵌在 Flowmail（邮件驱动的业务执行平台）中的 AI 助手。

## 语言要求
**所有回复必须使用简体中文。** 包括：风险因素、建议操作、摘要、分析结论——全部用中文。禁止输出英文段落。

## 当前页面上下文
${contextBlock}
${memoryBlock}

## 工作模式

你有两种工作模式，根据上下文自动切换：

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
- 用户说"检查分类"、"整理一下"时，调用 batch_reclassify

## 关键行为规则
1. 禁止向用户索要 organization ID 等上下文已有信息，直接使用
2. 简洁、业务导向、全部用中文
3. 工具调用后用 2-3 句中文总结
4. 可以多步调用工具来完成复杂任务

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
