"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	MailIcon,
	UserIcon,
	AlertCircleIcon,
	CheckCircle2Icon,
	ClockIcon,
	FlagIcon,
	StickyNoteIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	TrendingUpIcon,
	TrendingDownIcon,
	MinusIcon,
	PlusIcon,
	SparklesIcon,
	ShieldCheckIcon,
	BotIcon,
	PlugIcon,
} from "lucide-react";
import { useState } from "react";

interface TimelineEvent {
	id: string;
	type: string;
	content: string;
	metadata?: string | null;
	createdAt: string | Date;
	actor?: { id: string; name: string; image?: string | null } | null;
}

interface EntityTimelineProps {
	entityId: string;
	events: TimelineEvent[];
	entityType: string;
	status: string;
	extractedFields?: string | null;
}

// ── 节点分层配置 ──────────────────────────────────────────

const EVENT_LAYER: Record<string, "email" | "action" | "system"> = {
	email_received: "email",
	action_taken: "action",
	status_changed: "system",
	milestone: "action",
	note: "action",
};

const EVENT_ICONS: Record<string, typeof MailIcon> = {
	email_received: MailIcon,
	action_taken: CheckCircle2Icon,
	status_changed: AlertCircleIcon,
	milestone: FlagIcon,
	note: StickyNoteIcon,
};

const LAYER_DOT: Record<string, string> = {
	email:  "bg-blue-500 shadow-blue-200 dark:shadow-blue-900",
	action: "bg-emerald-500 shadow-emerald-200 dark:shadow-emerald-900",
	system: "bg-amber-500 shadow-amber-200 dark:shadow-amber-900",
};

const LAYER_ICON: Record<string, string> = {
	email:  "text-white",
	action: "text-white",
	system: "text-white",
};

const CONNECTOR: Record<string, string> = {
	email:  "bg-blue-100 dark:bg-blue-900/40",
	action: "bg-emerald-100 dark:bg-emerald-900/40",
	system: "bg-amber-100 dark:bg-amber-900/40",
};

// ── 工具函数 ──────────────────────────────────────────────

function formatTime(date: string | Date) {
	return new Date(date).toLocaleString("zh-CN", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function fieldLabel(key: string) {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/_/g, " ")
		.replace(/^\w/, (c) => c.toUpperCase())
		.trim();
}

// ── 子组件 ────────────────────────────────────────────────

/** 截止日期感知警告条 */
function DeadlineWarning({ extractedFields }: { extractedFields?: string | null }) {
	if (!extractedFields) { return null; }
	let fields: Record<string, unknown> = {};
	try { fields = JSON.parse(extractedFields); } catch { return null; }

	const raw = fields.deadline ?? fields.dueDate ?? fields.due_date ?? fields.deadlineDate;
	if (!raw || typeof raw !== "string") { return null; }

	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) { return null; }

	const diffDays = Math.ceil((d.getTime() - Date.now()) / 86400000);
	if (diffDays > 7) { return null; }

	const isOverdue = diffDays < 0;
	const isUrgent  = diffDays >= 0 && diffDays <= 2;
	const cls = isOverdue
		? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900"
		: isUrgent
			? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900"
			: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900";

	return (
		<div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${cls}`}>
			<ClockIcon className="size-3.5 shrink-0" />
			{isOverdue
				? `已逾期 ${Math.abs(diffDays)} 天`
				: diffDays === 0
					? "今天截止"
					: `截止还剩 ${diffDays} 天`}
		</div>
	);
}

/** 进度变化徽章 */
function DeltaBadge({ delta }: { delta?: number | null }) {
	if (delta == null) { return null; }
	const Icon = delta > 0 ? TrendingUpIcon : delta < 0 ? TrendingDownIcon : MinusIcon;
	const cls  = delta > 0 ? "text-emerald-600 dark:text-emerald-400"
		: delta < 0 ? "text-red-500 dark:text-red-400"
		: "text-muted-foreground";
	return (
		<span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${cls}`}>
			<Icon className="size-3" />
			{delta > 0 ? "+" : ""}{delta}%
		</span>
	);
}

/** AI 分析卡片 — 圆角矩形结构，附着在邮件节点下方 */
function AiAnalysisCard({ metadata, content }: { metadata?: string | null; content: string }) {
	const [open, setOpen] = useState(true);

	let meta: Record<string, unknown> = {};
	try { if (metadata) { meta = JSON.parse(metadata); } } catch {}

	const confidence    = meta.confidence as number | undefined;
	const categorySlug  = meta.categorySlug as string | undefined;
	const reasoning     = meta.reasoning as string | undefined;
	const extractedFields = meta.extractedFields as Record<string, unknown> | undefined;
	const progressDelta = meta.progressDelta as number | undefined;
	const riskSignals   = meta.riskSignals as string[] | undefined;

	const hasFields = extractedFields && Object.keys(extractedFields).length > 0;

	// 置信度颜色
	const confPct  = confidence != null ? Math.round(confidence * 100) : null;
	const confCls  = confPct == null ? "" : confPct >= 80 ? "text-emerald-600 dark:text-emerald-400"
		: confPct >= 60 ? "text-amber-600 dark:text-amber-400"
		: "text-red-500 dark:text-red-400";

	return (
		<div className="mt-2.5 rounded-xl border border-violet-200/70 bg-violet-50/60 dark:border-violet-800/50 dark:bg-violet-950/20 overflow-hidden">
			{/* 卡片标题行 */}
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors"
			>
				<div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-violet-500">
					<SparklesIcon className="size-3 text-white" />
				</div>
				<span className="flex-1 text-xs font-semibold text-violet-700 dark:text-violet-400">
					AI 解析结果
				</span>
				<div className="flex items-center gap-2">
					{confPct != null && (
						<span className={`text-[11px] font-medium ${confCls}`}>
							{confPct}% 置信
						</span>
					)}
					{categorySlug && (
						<Badge className="h-4 rounded-sm px-1.5 text-[10px] bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-800">
							{categorySlug}
						</Badge>
					)}
					<DeltaBadge delta={progressDelta} />
					{open ? <ChevronUpIcon className="size-3.5 text-violet-400" /> : <ChevronDownIcon className="size-3.5 text-violet-400" />}
				</div>
			</button>

			{open && (
				<div className="px-3 pb-3 space-y-2.5 border-t border-violet-200/60 dark:border-violet-800/40 pt-2.5">
					{/* AI 摘要文本 */}
					{content && (
						<p className="text-xs leading-relaxed text-violet-900/80 dark:text-violet-200/70">
							{content.replace(/^AI (解析完成|对比[^：：]*)[：:]?\s*/i, "")}
						</p>
					)}

					{/* 提取字段网格 */}
					{hasFields && (
						<div className="rounded-lg border border-violet-200/60 dark:border-violet-800/40 overflow-hidden">
							<table className="w-full text-xs">
								<tbody>
									{Object.entries(extractedFields).map(([k, v], i) => (
										<tr
											key={k}
											className={i % 2 === 0
												? "bg-white/60 dark:bg-white/5"
												: "bg-violet-50/40 dark:bg-violet-900/10"}
										>
											<td className="px-2.5 py-1.5 text-muted-foreground font-medium whitespace-nowrap w-[40%]">
												{fieldLabel(k)}
											</td>
											<td className="px-2.5 py-1.5 font-semibold text-foreground">
												{String(v)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{/* 风险信号 */}
					{riskSignals && riskSignals.length > 0 && (
						<div className="space-y-1">
							<p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
								风险信号
							</p>
							{riskSignals.map((s) => (
								<div key={s} className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
									<AlertCircleIcon className="size-3 mt-0.5 shrink-0" />
									{s}
								</div>
							))}
						</div>
					)}

					{/* 推理过程（折叠） */}
					{reasoning && (
						<details className="group">
							<summary className="cursor-pointer text-[11px] text-violet-500 dark:text-violet-400 select-none list-none flex items-center gap-1">
								<ChevronDownIcon className="size-3 transition-transform group-open:rotate-180" />
								查看推理过程
							</summary>
							<p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground pl-4 border-l border-violet-200 dark:border-violet-800">
								{reasoning}
							</p>
						</details>
					)}
				</div>
			)}
		</div>
	);
}

/** 来源标签 — 标注事件由哪个 Agent/渠道触发 */
function OriginBadge({ metadata }: { metadata?: string | null }) {
	if (!metadata) { return null; }
	let m: Record<string, unknown> = {};
	try { m = JSON.parse(metadata); } catch { return null; }

	const via = m.via as string | undefined;
	if (!via) { return null; }

	if (via === "openclaw" || via === "mcp") {
		return (
			<Badge className="h-4 rounded-sm px-1 text-[10px] bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800">
				<PlugIcon className="size-2.5 mr-0.5" />
				{via === "openclaw" ? "OpenClaw" : "MCP"}
			</Badge>
		);
	}

	if (via === "agent") {
		return (
			<Badge className="h-4 rounded-sm px-1 text-[10px] bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
				<BotIcon className="size-2.5 mr-0.5" />
				Agent
			</Badge>
		);
	}

	return null;
}

/** 手动添加备注 */
function AddNoteForm({ entityId, onAdded }: { entityId: string; onAdded: () => void }) {
	const [open, setOpen]       = useState(false);
	const [content, setContent] = useState("");
	const queryClient           = useQueryClient();

	const mutation = useMutation(
		orpc.flowEntities.addTimelineEvent.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.get.key({ input: { entityId } }) });
				setContent("");
				setOpen(false);
				onAdded();
			},
		}),
	);

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
			>
				<PlusIcon className="size-3.5" />
				添加备注
			</button>
		);
	}

	return (
		<div className="space-y-2">
			<Textarea
				placeholder="记录备注、里程碑或决策..."
				value={content}
				onChange={(e) => setContent(e.target.value)}
				className="text-sm min-h-[72px] resize-none"
				autoFocus
			/>
			<div className="flex gap-2">
				<Button size="sm" disabled={!content.trim() || mutation.isPending}
					onClick={() => mutation.mutate({ entityId, type: "note", content: content.trim() })}>
					保存
				</Button>
				<Button size="sm" variant="ghost" onClick={() => { setOpen(false); setContent(""); }}>
					取消
				</Button>
			</div>
		</div>
	);
}

// ── 主组件 ────────────────────────────────────────────────

export function EntityTimeline({
	entityId,
	events,
	entityType: _entityType,
	status: _status,
	extractedFields,
}: EntityTimelineProps) {
	const [filter, setFilter] = useState<"all" | "email" | "action" | "system">("all");

	// 把 ai_summary 事件索引到离它最近的前一个 email_received 事件上
	const emailAiMap = new Map<string, TimelineEvent>();
	let lastEmailId: string | null = null;

	for (const ev of events) {
		if (ev.type === "email_received") {
			lastEmailId = ev.id;
		} else if (ev.type === "ai_summary" && lastEmailId) {
			// 附着到最近的邮件节点
			emailAiMap.set(lastEmailId, ev);
		}
	}

	// 过滤掉 ai_summary（它以子卡片形式展示）
	const primaryEvents = events.filter((e) => e.type !== "ai_summary");

	const filters: { id: typeof filter; label: string }[] = [
		{ id: "all",    label: "全部" },
		{ id: "email",  label: "邮件" },
		{ id: "action", label: "操作" },
		{ id: "system", label: "状态" },
	];

	const visible = primaryEvents.filter((e) => {
		if (filter === "all") { return true; }
		return EVENT_LAYER[e.type] === filter;
	});

	return (
		<div className="space-y-3">
			{/* 顶部：标题 + 过滤器 */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
					<ClockIcon className="size-4 text-muted-foreground" />
					时间线
				</div>
				<div className="flex gap-0.5 rounded-md border bg-muted/40 p-0.5">
					{filters.map((f) => (
						<button
							key={f.id}
							type="button"
							onClick={() => setFilter(f.id)}
							className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
								filter === f.id
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{f.label}
						</button>
					))}
				</div>
			</div>

			{/* 截止感知警告 */}
			<DeadlineWarning extractedFields={extractedFields} />

			{/* 时间线主体 */}
			<div>
				{visible.length === 0 && (
					<p className="py-6 text-center text-xs text-muted-foreground">暂无事件</p>
				)}

				{visible.map((event, idx) => {
					const layer     = EVENT_LAYER[event.type] ?? "system";
					const Icon      = EVENT_ICONS[event.type] ?? ClockIcon;
					const dotCls    = LAYER_DOT[layer];
					const iconCls   = LAYER_ICON[layer];
					const connCls   = CONNECTOR[layer];
					const isLast    = idx === visible.length - 1;
					const aiSummary = event.type === "email_received" ? emailAiMap.get(event.id) : undefined;

					return (
						<div key={event.id} className="flex gap-3">
							{/* 竖轴：圆点 + 连线 */}
							<div className="flex flex-col items-center">
								<div className={`flex size-6 shrink-0 items-center justify-center rounded-full shadow-sm ${dotCls}`}>
									<Icon className={`size-3 ${iconCls}`} />
								</div>
								{!isLast && (
									<div className={`w-px flex-1 min-h-[20px] mt-0.5 ${connCls}`} />
								)}
							</div>

							{/* 内容区 */}
							<div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
								{/* 时间戳 + actor */}
								<div className="flex items-center gap-2 flex-wrap mb-0.5">
									<span className="text-[11px] text-muted-foreground tabular-nums">
										{formatTime(event.createdAt)}
									</span>
									{event.actor && (
										<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
											<UserIcon className="size-3" />
											{event.actor.name}
										</span>
									)}
									{/* 里程碑标记 */}
									{event.type === "milestone" && (
										<Badge className="h-4 rounded-sm px-1 text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
											里程碑
										</Badge>
									)}
								{/* 已验证标记（action_taken with approved/rejected） */}
								{event.type === "action_taken" && (() => {
									let m: Record<string, unknown> = {};
									try { if (event.metadata) { m = JSON.parse(event.metadata); } } catch {}
									const action = m.action as string | undefined;
									if (action === "approved") {
										return (
											<Badge className="h-4 rounded-sm px-1 text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
												<ShieldCheckIcon className="size-2.5 mr-0.5" />批准
											</Badge>
										);
									}
									if (action === "rejected") {
										return (
											<Badge className="h-4 rounded-sm px-1 text-[10px] bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
												拒绝
											</Badge>
										);
									}
									return null;
								})()}
								{/* 来源标签（Agent / OpenClaw / MCP） */}
								<OriginBadge metadata={event.metadata} />
							</div>

								{/* 主文本 */}
								<p className="text-sm text-foreground leading-snug">
									{event.content}
								</p>

								{/* AI 分析卡片 — 仅附着于邮件节点 */}
								{aiSummary && (
									<AiAnalysisCard
										content={aiSummary.content}
										metadata={aiSummary.metadata}
									/>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* 底部：添加备注 */}
			<div className="border-t pt-3">
				<AddNoteForm entityId={entityId} onAdded={() => {}} />
			</div>
		</div>
	);
}
