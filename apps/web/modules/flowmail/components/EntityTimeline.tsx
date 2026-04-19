"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAgent } from "./AgentProvider";
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
	LightbulbIcon,
	AlertTriangleIcon,
	ZapIcon,
	SendIcon,
	PaperclipIcon,
} from "lucide-react";
import { useState, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────

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
	entityTitle?: string;
	events: TimelineEvent[];
	entityType: string;
	status: string;
	extractedFields?: string | null;
}

interface AISuggestion {
	id: string;
	intent: string;
	message: string;
	severity: "info" | "warning" | "critical";
	actions?: {
		label: string;
		tool: string;
		params: Record<string, unknown>;
		confirmRequired: boolean;
	}[];
	status: "pending" | "accepted" | "dismissed";
}

// ── Layer config ──────────────────────────────────────────

const EVENT_LAYER: Record<string, "email" | "action" | "system"> = {
	email_received: "email",
	email_sent: "email",
	action_taken: "action",
	status_changed: "system",
	milestone: "action",
	note: "action",
	attachment_parsed: "system",
	needs_user_decision: "system",
};

const EVENT_ICONS: Record<string, typeof MailIcon> = {
	email_received: MailIcon,
	email_sent: SendIcon,
	action_taken: CheckCircle2Icon,
	status_changed: AlertCircleIcon,
	milestone: FlagIcon,
	note: StickyNoteIcon,
	attachment_parsed: PaperclipIcon,
	needs_user_decision: AlertTriangleIcon,
};

const LAYER_COLORS = {
	email: {
		dot: "bg-zinc-700 dark:bg-zinc-300",
		border: "border-border",
		bg: "bg-muted/30",
		connector: "bg-border",
	},
	action: {
		dot: "bg-zinc-900 dark:bg-zinc-100",
		border: "border-border",
		bg: "bg-muted/30",
		connector: "bg-border",
	},
	system: {
		dot: "bg-zinc-500",
		border: "border-border",
		bg: "bg-muted/30",
		connector: "bg-border",
	},
};

// ── Severity → visual weight ─────────────────────────────

type Severity = "info" | "warning" | "critical";

function detectSeverity(aiMeta?: Record<string, unknown>): Severity {
	if (!aiMeta) {
		return "info";
	}
	const riskSignals = aiMeta.riskSignals as string[] | undefined;
	const extractedFields = aiMeta.extractedFields as Record<string, unknown> | undefined;
	const risk = extractedFields?.risk as string | undefined;
	const urgency = extractedFields?.urgency as string | undefined;

	if (
		urgency === "紧急" ||
		risk === "高" ||
		(riskSignals && riskSignals.length >= 2)
	) {
		return "critical";
	}
	if (
		risk === "中" || risk === "中等" ||
		(riskSignals && riskSignals.length >= 1)
	) {
		return "warning";
	}
	return "info";
}

const SEVERITY_ACCENT: Record<Severity, string> = {
	info: "border-l-zinc-400 dark:border-l-zinc-500",
	warning: "border-l-amber-400 dark:border-l-amber-500",
	critical: "border-l-red-400 dark:border-l-red-500",
};

const SEVERITY_GLOW: Record<Severity, string> = {
	info: "",
	warning: "ring-1 ring-amber-200/40 dark:ring-amber-700/30",
	critical: "ring-1 ring-red-200/40 dark:ring-red-700/30",
};

// ── Helpers ───────────────────────────────────────────────

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

function parseMeta(raw?: string | null): Record<string, unknown> {
	if (!raw) {
		return {};
	}
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

// ── Sub-components ────────────────────────────────────────

function DeadlineWarning({ extractedFields }: { extractedFields?: string | null }) {
	if (!extractedFields) {
		return null;
	}
	let fields: Record<string, unknown> = {};
	try {
		fields = JSON.parse(extractedFields);
	} catch {
		return null;
	}

	const raw = fields.deadline ?? fields.dueDate ?? fields.due_date ?? fields.deadlineDate;
	if (!raw || typeof raw !== "string") {
		return null;
	}

	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) {
		return null;
	}

	const diffDays = Math.ceil((d.getTime() - Date.now()) / 86400000);
	if (diffDays > 7) {
		return null;
	}

	const isOverdue = diffDays < 0;
	const isUrgent = diffDays >= 0 && diffDays <= 2;
	const cls = isOverdue
		? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900"
		: isUrgent
			? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900"
			: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900";

	return (
		<div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium", cls)}>
			<ClockIcon className="size-3.5 shrink-0" />
			{isOverdue
				? `已逾期 ${Math.abs(diffDays)} 天`
				: diffDays === 0
					? "今天截止"
					: `截止还剩 ${diffDays} 天`}
		</div>
	);
}

function DeltaBadge({ delta }: { delta?: number | null }) {
	if (delta == null) {
		return null;
	}
	const Icon = delta > 0 ? TrendingUpIcon : delta < 0 ? TrendingDownIcon : MinusIcon;
	const cls = delta > 0
		? "text-emerald-600 dark:text-emerald-400"
		: delta < 0
			? "text-red-500 dark:text-red-400"
			: "text-muted-foreground";
	return (
		<span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold", cls)}>
			<Icon className="size-3" />
			{delta > 0 ? "+" : ""}{delta}%
		</span>
	);
}

/** AI 摘要行 — 默认展示，替代完整卡片 */
function AiSummaryLine({ aiEvent }: { aiEvent: TimelineEvent }) {
	const meta = parseMeta(aiEvent.metadata);
	const confidence = meta.confidence as number | undefined;
	const progressDelta = meta.progressDelta as number | undefined;
	const categorySlug = meta.categorySlug as string | undefined;
	const extractedFields = meta.extractedFields as Record<string, unknown> | undefined;

	const confPct = confidence != null ? Math.round(confidence * 100) : null;

	const summaryParts: string[] = [];
	if (extractedFields) {
		const progress = extractedFields.progress as string | undefined;
		const risk = extractedFields.risk as string | undefined;
		const blocker = extractedFields.blocker as string | undefined;
		if (progress) {
			summaryParts.push(`进度 ${progress}`);
		}
		if (risk && risk !== "无") {
			summaryParts.push(`风险: ${risk}`);
		}
		if (blocker) {
			summaryParts.push(`阻塞: ${blocker}`);
		}
	}

	return (
		<div className="flex items-center gap-2 flex-wrap text-[11px] leading-5">
			<span className="inline-flex items-center gap-1 text-foreground/60 font-medium">
				<SparklesIcon className="size-3 shrink-0" />
				<span>AI</span>
			</span>
			{confPct != null && (
				<span className={cn(
					"font-medium leading-5",
					confPct >= 80
						? "text-emerald-600 dark:text-emerald-400"
						: confPct >= 60
							? "text-amber-600 dark:text-amber-400"
							: "text-red-500 dark:text-red-400",
				)}>
					{confPct}%
				</span>
			)}
			{categorySlug && (
				<span className="inline-flex items-center rounded-sm px-1 py-px text-[10px] font-medium leading-none bg-muted text-muted-foreground border uppercase">
					{categorySlug}
				</span>
			)}
			{summaryParts.length > 0 && (
				<span className="text-muted-foreground leading-5">{summaryParts.join(" · ")}</span>
			)}
			<DeltaBadge delta={progressDelta} />
		</div>
	);
}

/** AI 分析详情卡 — 可折叠展开 */
function AiDetailPanel({ aiEvent }: { aiEvent: TimelineEvent }) {
	const meta = parseMeta(aiEvent.metadata);
	const extractedFields = meta.extractedFields as Record<string, unknown> | undefined;
	const riskSignals = meta.riskSignals as string[] | undefined;
	const reasoning = meta.reasoning as string | undefined;
	const progressDelta = meta.progressDelta as number | undefined;
	const hasFields = extractedFields && Object.keys(extractedFields).length > 0;
	const progress = extractedFields?.progress as string | undefined;

	const content = aiEvent.content.replace(/^AI (解析完成|对比[^：：]*)[：:]?\s*/i, "");

	return (
		<div className="space-y-2 pt-2">
			{content && (
				<p className="text-xs leading-relaxed text-muted-foreground">
					{content}
				</p>
			)}

			{progressDelta != null && progressDelta !== 0 && progress && (
				<div className={cn(
					"flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium",
					progressDelta > 0
						? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
						: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
				)}>
					{progressDelta > 0 ? (
						<TrendingUpIcon className="size-3.5 shrink-0" />
					) : (
						<TrendingDownIcon className="size-3.5 shrink-0" />
					)}
					<span>
						进度 {progress}（{progressDelta > 0 ? "+" : ""}{progressDelta}% vs 上次）
					</span>
				</div>
			)}

			{hasFields && (
				<div className="rounded-md border overflow-hidden">
					<table className="w-full text-xs table-fixed">
						<tbody>
							{Object.entries(extractedFields).map(([k, v], i) => (
								<tr
									key={k}
									className={i % 2 === 0
										? "bg-white/60 dark:bg-white/5"
										: "bg-muted/40"}
								>
									<td className="px-2.5 py-1.5 text-muted-foreground font-medium whitespace-nowrap w-[35%] align-middle">
										{fieldLabel(k)}
									</td>
									<td className="px-2.5 py-1.5 font-semibold text-foreground align-middle text-left">
										{String(v)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

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

			{reasoning && (
				<details className="group">
					<summary className="cursor-pointer text-[11px] text-muted-foreground select-none list-none flex items-center gap-1 hover:text-foreground transition-colors">
						<ChevronDownIcon className="size-3 transition-transform group-open:rotate-180" />
						查看推理过程
					</summary>
					<p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground pl-4 border-l border-border">
						{reasoning}
					</p>
				</details>
			)}
		</div>
	);
}

/** Suggestion 渲染 — severity 驱动视觉，按钮点击 → 确认 → Agent 执行 */
function SuggestionBar({
	suggestion,
	entityId,
	entityTitle,
}: {
	suggestion: AISuggestion;
	entityId: string;
	entityTitle: string;
}) {
	const [dismissed, setDismissed] = useState(suggestion.status === "dismissed");
	const [confirmAction, setConfirmAction] = useState<AISuggestion["actions"]>(undefined);
	const [confirmIdx, setConfirmIdx] = useState(0);
	const { executeSuggestion } = useAgent();

	if (dismissed) {
		return null;
	}

	const isAccepted = suggestion.status === "accepted";

	const ICON_MAP: Record<Severity, typeof LightbulbIcon> = {
		info: LightbulbIcon,
		warning: AlertTriangleIcon,
		critical: ZapIcon,
	};
	const Icon = ICON_MAP[suggestion.severity];

	const COLORS: Record<Severity, string> = {
		info: "border-l-zinc-400 bg-muted/40",
		warning: "border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10",
		critical: "border-l-red-400 bg-red-50/30 dark:bg-red-950/10",
	};

	const ICON_COLORS: Record<Severity, string> = {
		info: "text-muted-foreground",
		warning: "text-amber-500 dark:text-amber-400",
		critical: "text-red-500 dark:text-red-400",
	};

	function handleActionClick(action: NonNullable<AISuggestion["actions"]>[number], idx: number) {
		if (action.confirmRequired) {
			setConfirmAction(suggestion.actions);
			setConfirmIdx(idx);
		} else {
			dispatchExecution(action);
		}
	}

	function dispatchExecution(action: NonNullable<AISuggestion["actions"]>[number]) {
		executeSuggestion({
			entityId,
			entityTitle,
			actionLabel: action.label,
			actionTool: action.tool,
			actionParams: action.params,
			suggestionMessage: suggestion.message,
			severity: suggestion.severity,
		});
	}

	const pendingAction = confirmAction?.[confirmIdx];

	return (
		<>
			<div className={cn(
				"border-l-2 rounded-r-md px-3 py-2 mt-2",
				isAccepted ? "border-l-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 opacity-70" : COLORS[suggestion.severity],
			)}>
				<div className="flex items-start gap-2">
					{isAccepted
						? <CheckCircle2Icon className="size-3.5 mt-0.5 shrink-0 text-emerald-500" />
						: <Icon className={cn("size-3.5 mt-0.5 shrink-0", ICON_COLORS[suggestion.severity])} />}
					<div className="flex-1 min-w-0">
						<p className={cn("text-xs leading-relaxed", isAccepted ? "text-muted-foreground line-through" : "text-foreground/80")}>
							{suggestion.message}
						</p>
						{!isAccepted && suggestion.actions && suggestion.actions.length > 0 && (
							<div className="flex gap-2 mt-1.5 flex-wrap">
								{suggestion.actions.map((action, i) => (
									<Button
										key={action.label}
										size="sm"
										variant={i === 0 ? "secondary" : "outline"}
										className={cn(
											"h-6 text-[11px] px-2.5 font-medium",
											i === 0 && suggestion.severity === "critical" && "bg-red-600 text-white hover:bg-red-700 border-red-600",
											i === 0 && suggestion.severity === "warning" && "bg-amber-600 text-white hover:bg-amber-700 border-amber-600",
											i === 0 && suggestion.severity === "info" && "bg-blue-600 text-white hover:bg-blue-700 border-blue-600",
											i > 0 && "border-foreground/20 text-foreground/70 bg-background hover:bg-muted",
										)}
										onClick={() => handleActionClick(action, i)}
									>
										{action.label}
									</Button>
								))}
								<Button
									size="sm"
									variant="ghost"
									className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
									onClick={() => setDismissed(true)}
								>
									忽略
								</Button>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Confirm dialog */}
			<AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) { setConfirmAction(undefined); } }}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>确认执行</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="space-y-2">
								<p>即将让 Agent 执行以下操作：</p>
								<div className="rounded-md border bg-muted/50 p-3 text-sm">
									<p className="font-medium text-foreground">{pendingAction?.label}</p>
									<p className="text-muted-foreground mt-1 text-xs">{suggestion.message}</p>
								</div>
								<p className="text-xs text-muted-foreground">
									Agent 会根据上下文自主判断具体执行步骤，可能包含多个操作。
								</p>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>取消</AlertDialogCancel>
						<AlertDialogAction onClick={() => {
							if (pendingAction) {
								dispatchExecution(pendingAction);
							}
							setConfirmAction(undefined);
						}}>
							确认执行
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function OriginBadge({ metadata }: { metadata?: string | null }) {
	if (!metadata) {
		return null;
	}
	let m: Record<string, unknown> = {};
	try {
		m = JSON.parse(metadata);
	} catch {
		return null;
	}

	const via = m.via as string | undefined;
	if (!via) {
		return null;
	}

	if (via === "openclaw" || via === "mcp") {
		return (
			<span className="inline-flex items-center gap-0.5 rounded-sm px-1 py-px text-[10px] font-medium leading-none bg-muted text-muted-foreground border">
				<PlugIcon className="size-2.5" />
				{via === "openclaw" ? "OpenClaw" : "MCP"}
			</span>
		);
	}

	if (via === "agent") {
		return (
			<span className="inline-flex items-center gap-0.5 rounded-sm px-1 py-px text-[10px] font-medium leading-none bg-muted text-muted-foreground border">
				<BotIcon className="size-2.5" />
				Agent
			</span>
		);
	}

	return null;
}

function AddNoteForm({ entityId, onAdded }: { entityId: string; onAdded: () => void }) {
	const [open, setOpen] = useState(false);
	const [content, setContent] = useState("");
	const queryClient = useQueryClient();

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

// ── Main ──────────────────────────────────────────────────

export function EntityTimeline({
	entityId,
	entityTitle = "",
	events,
	entityType: _entityType,
	status: _status,
	extractedFields,
}: EntityTimelineProps) {
	const [filter, setFilter] = useState<"all" | "email" | "action" | "system">("all");
	const [expandedAi, setExpandedAi] = useState<Set<string>>(new Set());

	const { emailAiMap, primaryEvents } = useMemo(() => {
		const map = new Map<string, TimelineEvent>();
		let lastEmailId: string | null = null;

		const chronological = [...events].sort(
			(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		);
		for (const ev of chronological) {
			if (ev.type === "email_received") {
				lastEmailId = ev.id;
			} else if (ev.type === "ai_summary" && lastEmailId) {
				map.set(lastEmailId, ev);
			}
		}

		return {
			emailAiMap: map,
			primaryEvents: events.filter((e) => e.type !== "ai_summary"),
		};
	}, [events]);

	const filters: { id: typeof filter; label: string }[] = [
		{ id: "all", label: "全部" },
		{ id: "email", label: "邮件" },
		{ id: "action", label: "操作" },
		{ id: "system", label: "状态" },
	];

	const visible = primaryEvents.filter((e) => {
		if (filter === "all") {
			return true;
		}
		return EVENT_LAYER[e.type] === filter;
	});

	function toggleAiDetail(eventId: string) {
		setExpandedAi((prev) => {
			const next = new Set(prev);
			if (next.has(eventId)) {
				next.delete(eventId);
			} else {
				next.add(eventId);
			}
			return next;
		});
	}

	return (
		<div className="space-y-3">
			{/* Header: title + filters */}
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
							className={cn(
								"rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
								filter === f.id
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{f.label}
						</button>
					))}
				</div>
			</div>

			<DeadlineWarning extractedFields={extractedFields} />

			{/* Timeline body */}
			<div>
				{visible.length === 0 && (
					<p className="py-6 text-center text-xs text-muted-foreground">暂无事件</p>
				)}

				{visible.map((event, idx) => {
					const layer = EVENT_LAYER[event.type] ?? "system";
					const colors = LAYER_COLORS[layer];
					const Icon = EVENT_ICONS[event.type] ?? ClockIcon;
					const isSent = event.type === "email_sent";
					const dotColor = isSent ? "bg-zinc-800 dark:bg-zinc-200" : colors.dot;
					const isLast = idx === visible.length - 1;
					const aiSummary = event.type === "email_received" ? emailAiMap.get(event.id) : undefined;
					const aiMeta = aiSummary ? parseMeta(aiSummary.metadata) : undefined;
					const severity = aiSummary ? detectSeverity(aiMeta) : "info";
					const isAiExpanded = expandedAi.has(event.id);

					const suggestions = aiMeta?.suggestions as AISuggestion[] | undefined;

					const meta = parseMeta(event.metadata);

					return (
						<div key={event.id} className="flex gap-3">
							{/* Vertical axis: dot + connector */}
							<div className="flex flex-col items-center">
								<div className={cn(
									"flex size-7 shrink-0 items-center justify-center rounded-full",
									dotColor,
								)}>
									<Icon className="size-3.5 text-white" />
								</div>
								{!isLast && (
									<div className={cn("w-0.5 flex-1 min-h-[16px] mt-0.5 rounded-full", colors.connector)} />
								)}
							</div>

							{/* Content: node card */}
							<div className={cn("flex-1 min-w-0", isLast ? "pb-0" : "pb-3")}>
								<div
									className={cn(
										"rounded-lg border p-3 transition-all",
										colors.border,
										colors.bg,
										aiSummary && severity !== "info" && "border-l-[3px]",
										aiSummary && SEVERITY_ACCENT[severity],
										aiSummary && SEVERITY_GLOW[severity],
									)}
								>
									{/* Row 1: timestamp + actor */}
									<div className="flex items-center gap-2 mb-1.5">
										<span className="text-[11px] text-muted-foreground tabular-nums font-medium">
											{formatTime(event.createdAt)}
										</span>
										{event.actor && (
											<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
												<UserIcon className="size-3" />
												{event.actor.name}
											</span>
										)}
										<OriginBadge metadata={event.metadata} />
									</div>

									{/* Row 2: main content */}
									<p className="text-sm text-foreground leading-snug font-medium">
										{event.content}
									</p>

									{/* Row 3: badges (below content, not overlapping) */}
									{(event.type === "milestone" || event.type === "action_taken") && (
										<div className="flex items-center gap-1.5 mt-1.5">
											{event.type === "milestone" && (
												<span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
													🏁 里程碑
												</span>
											)}
											{event.type === "action_taken" && (() => {
												const action = meta.action as string | undefined;
												if (action === "approved") {
													return (
														<span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
															<ShieldCheckIcon className="size-3 shrink-0" />
															<span>已批准</span>
														</span>
													);
												}
												if (action === "rejected") {
													return (
														<span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
															<span>已拒绝</span>
														</span>
													);
												}
												return null;
											})()}
										</div>
									)}

									{/* AI section (only for email nodes with ai_summary) */}
									{aiSummary && (
										<div className="mt-2 pt-2 border-t border-border/60">
											<button
												type="button"
												onClick={() => toggleAiDetail(event.id)}
												className="w-full text-left hover:bg-muted/50 -mx-1 px-1 rounded transition-colors"
											>
												<div className="flex items-center justify-between">
													<AiSummaryLine aiEvent={aiSummary} />
													{isAiExpanded
														? <ChevronUpIcon className="size-3.5 text-muted-foreground shrink-0" />
														: <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0" />}
												</div>
											</button>

											{isAiExpanded && <AiDetailPanel aiEvent={aiSummary} />}
										</div>
									)}

									{/* Suggestions */}
									{suggestions && suggestions.length > 0 && suggestions.map((s) => (
										<SuggestionBar key={s.id} suggestion={s} entityId={entityId} entityTitle={entityTitle} />
									))}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Footer: add note */}
			<div className="border-t pt-3">
				<AddNoteForm entityId={entityId} onAdded={() => {}} />
			</div>
		</div>
	);
}
