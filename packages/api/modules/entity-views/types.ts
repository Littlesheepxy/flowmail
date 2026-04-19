import { z } from "zod";

// ─── Block schemas ──────────────────────────────────────────
//
// 每种 block 都是一个 discriminated union 的成员，type 字段做判别。
// Agent 用这套 schema 拼出视图，前端 ViewRenderer 按 type 路由到对应组件。

const SummaryBlockSchema = z.object({
	type: z.literal("summary"),
	id: z.string().optional(),
	title: z.string().optional(),
	text: z.string(),
	tone: z.enum(["info", "success", "warning", "danger", "neutral"]).optional(),
});

const KpiCardItemSchema = z.object({
	label: z.string(),
	value: z.union([z.string(), z.number()]),
	delta: z.string().optional(),
	tone: z.enum(["info", "success", "warning", "danger", "neutral"]).optional(),
	hint: z.string().optional(),
});

const KpiCardsBlockSchema = z.object({
	type: z.literal("kpi_cards"),
	id: z.string().optional(),
	title: z.string().optional(),
	items: z.array(KpiCardItemSchema).max(8),
});

const TodoItemSchema = z.object({
	id: z.string(),
	text: z.string(),
	status: z.enum(["pending", "in_progress", "blocked", "completed"]).default("pending"),
	source: z.string().optional(),
	dueDate: z.string().optional(),
});

const TodoListBlockSchema = z.object({
	type: z.literal("todo_list"),
	id: z.string().optional(),
	title: z.string().optional(),
	source: z.enum(["auto", "manual"]).default("auto"),
	items: z.array(TodoItemSchema).optional(),
	groupBy: z.enum(["none", "status"]).default("status"),
});

const TimelineBlockSchema = z.object({
	type: z.literal("timeline"),
	id: z.string().optional(),
	title: z.string().optional(),
	groupBy: z.enum(["none", "month", "week", "sender"]).default("none"),
	filter: z
		.object({
			eventTypes: z.array(z.string()).optional(),
			sinceDays: z.number().optional(),
			month: z.string().optional(),
		})
		.optional(),
	limit: z.number().min(1).max(200).optional(),
});

const TableBlockSchema = z.object({
	type: z.literal("table"),
	id: z.string().optional(),
	title: z.string().optional(),
	columns: z.array(z.object({ key: z.string(), label: z.string() })),
	rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
});

const QuickActionSchema = z.object({
	label: z.string(),
	prompt: z.string().describe("点击后发给 Agent 的 prompt"),
	tone: z.enum(["primary", "secondary", "destructive"]).default("secondary"),
	icon: z.string().optional(),
});

const QuickActionsBlockSchema = z.object({
	type: z.literal("quick_actions"),
	id: z.string().optional(),
	title: z.string().optional(),
	actions: z.array(QuickActionSchema).max(8),
});

export const ViewBlockSchema = z.discriminatedUnion("type", [
	SummaryBlockSchema,
	KpiCardsBlockSchema,
	TodoListBlockSchema,
	TimelineBlockSchema,
	TableBlockSchema,
	QuickActionsBlockSchema,
]);

export const ViewSpecSchema = z.object({
	blocks: z.array(ViewBlockSchema).max(20),
});

export type ViewBlock = z.infer<typeof ViewBlockSchema>;
export type ViewSpec = z.infer<typeof ViewSpecSchema>;
export type SummaryBlock = z.infer<typeof SummaryBlockSchema>;
export type KpiCardsBlock = z.infer<typeof KpiCardsBlockSchema>;
export type TodoListBlock = z.infer<typeof TodoListBlockSchema>;
export type TimelineBlock = z.infer<typeof TimelineBlockSchema>;
export type TableBlock = z.infer<typeof TableBlockSchema>;
export type QuickActionsBlock = z.infer<typeof QuickActionsBlockSchema>;

// ─── Procedure inputs ───────────────────────────────────────

export const listEntityViewsSchema = z.object({
	entityId: z.string().optional(),
	categoryId: z.string().optional(),
	organizationId: z.string().optional(),
});

export const getEntityViewSchema = z.object({
	viewId: z.string(),
});

export const createEntityViewSchema = z
	.object({
		title: z.string().min(1).max(60),
		icon: z.string().optional(),
		spec: ViewSpecSchema,
		entityId: z.string().optional(),
		categoryId: z.string().optional(),
		organizationId: z.string().optional(),
		isPinned: z.boolean().optional(),
	})
	.refine((v) => !!v.entityId || !!v.categoryId, {
		message: "必须提供 entityId 或 categoryId",
	});

export const updateEntityViewSchema = z.object({
	viewId: z.string(),
	title: z.string().min(1).max(60).optional(),
	icon: z.string().optional(),
	spec: ViewSpecSchema.optional(),
	isPinned: z.boolean().optional(),
	sortOrder: z.number().optional(),
});

export const deleteEntityViewSchema = z.object({
	viewId: z.string(),
});

// ─── Block component descriptor (for Agent's `list_view_components`) ───

export const VIEW_COMPONENT_DOCS = [
	{
		type: "summary",
		description: "纯文本/Markdown 摘要块。适合开头总览。",
		props: { title: "可选标题", text: "正文（支持 markdown）", tone: "info|success|warning|danger|neutral" },
	},
	{
		type: "kpi_cards",
		description: "数字卡片网格，每张卡片 label + value (+ 可选 delta)。适合关键指标。",
		props: { title: "可选标题", items: "[{label, value, delta?, tone?, hint?}]" },
	},
	{
		type: "todo_list",
		description: "待办列表。source=auto 时前端自动从 entity.extractedFields 聚合；source=manual 时使用 items。",
		props: { source: "auto|manual", items: "[{id,text,status,source?,dueDate?}]", groupBy: "none|status" },
	},
	{
		type: "timeline",
		description: "时间线。可按月/周/发件人分组，可过滤事件类型。复用现有 EntityTimeline 组件。",
		props: { groupBy: "none|month|week|sender", filter: "{eventTypes?, sinceDays?, month?}", limit: "1-200" },
	},
	{
		type: "table",
		description: "结构化表格，columns + rows。适合附件清单、对比数据。",
		props: { columns: "[{key,label}]", rows: "[{key:value}]" },
	},
	{
		type: "quick_actions",
		description: "用户预设的快捷按钮组。点击会以 prompt 发给 Agent 执行。",
		props: { actions: "[{label, prompt, tone?, icon?}]" },
	},
] as const;
