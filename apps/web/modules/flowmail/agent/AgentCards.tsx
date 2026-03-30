"use client";

/**
 * Agent UI 卡片组件库（A2UI 思路）
 *
 * AI 决定渲染哪种卡片，前端负责实际渲染。
 * 每张卡片都是一个独立的 GUI 组件，不是纯文本。
 */

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	CheckIcon,
	XIcon,
	AlertTriangleIcon,
	TrendingUpIcon,
	TrendingDownIcon,
	ClockIcon,
	FlagIcon,
	ShieldCheckIcon,
	ShieldAlertIcon,
	ArrowRightIcon,
	MinusIcon,
	SparklesIcon,
} from "lucide-react";
import type {
	ApprovalCardData,
	ReportCardData,
	RiskCardData,
	TimelineDiffCardData,
	EntityListCardData,
	ActionResultCardData,
	AgentUICard,
} from "./types";

// ── 工具函数 ──────────────────────────────────────────────

const RISK_CONFIG = {
	low:      { label: "低风险",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900" },
	medium:   { label: "中风险",   cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900" },
	high:     { label: "高风险",   cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900" },
	critical: { label: "严重风险", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900" },
} as const;

const SIG_COLORS = {
	low:      "text-muted-foreground",
	medium:   "text-amber-600 dark:text-amber-400",
	high:     "text-orange-600 dark:text-orange-400",
	critical: "text-red-600 dark:text-red-400",
} as const;

// ── 审批卡片 ──────────────────────────────────────────────

export function ApprovalCard({
	data,
	onAction,
}: {
	data: ApprovalCardData;
	onAction?: (action: "approved" | "rejected") => void;
}) {
	const queryClient = useQueryClient();

	const approveMutation = useMutation(
		orpc.approvals.approve.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.get.key({ input: { entityId: data.entityId } }) });
				onAction?.("approved");
			},
		}),
	);
	const rejectMutation = useMutation(
		orpc.approvals.reject.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.flowEntities.get.key({ input: { entityId: data.entityId } }) });
				onAction?.("rejected");
			},
		}),
	);

	const isPending = data.currentStatus === "pending";
	const isBusy    = approveMutation.isPending || rejectMutation.isPending;

	const deadlineDate = data.deadline ? new Date(data.deadline) : null;
	const daysLeft     = deadlineDate
		? Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000)
		: null;
	const isUrgent = data.urgency === "紧急" || data.urgency === "urgent" || (daysLeft != null && daysLeft <= 2);

	return (
		<div className="rounded-xl border overflow-hidden bg-card">
			{/* 标题行 */}
			<div className={`px-3.5 py-2.5 flex items-center gap-2 border-b ${isUrgent ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/30"}`}>
				<ShieldCheckIcon className={`size-4 shrink-0 ${isUrgent ? "text-red-500" : "text-violet-500"}`} />
				<span className="text-xs font-semibold text-foreground flex-1 truncate">
					{data.title}
				</span>
				{isUrgent && (
					<Badge className="h-4 rounded-sm px-1 text-[10px] bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
						紧急
					</Badge>
				)}
				<Badge
					status={
						data.currentStatus === "approved" ? "success"
						: data.currentStatus === "rejected" ? "error"
						: "warning"
					}
					className="h-4 rounded-sm px-1.5 text-[10px]"
				>
					{data.currentStatus === "pending" ? "待审批"
						: data.currentStatus === "approved" ? "已批准"
						: data.currentStatus === "rejected" ? "已拒绝"
						: data.currentStatus}
				</Badge>
			</div>

			{/* 字段表格 */}
			<div className="px-3.5 py-2 space-y-0">
				{data.applicant && (
					<Row label="申请人" value={data.applicant} />
				)}
				{data.amount && (
					<Row label="金额" value={<span className="text-lg font-bold text-foreground">{data.amount}</span>} />
				)}
				{data.purpose && (
					<Row label="用途" value={data.purpose} />
				)}
				{daysLeft != null && (
					<Row
						label="截止日期"
						value={
							<span className={daysLeft < 0 ? "text-red-600 font-semibold" : daysLeft <= 2 ? "text-amber-600 font-semibold" : ""}>
								{data.deadline}
								{daysLeft < 0
									? ` (逾期 ${Math.abs(daysLeft)} 天)`
									: daysLeft === 0
										? " (今天)"
										: ` (还剩 ${daysLeft} 天)`}
							</span>
						}
					/>
				)}
			</div>

			{/* 操作按钮 */}
			{isPending && (
				<div className="px-3.5 py-2.5 border-t bg-muted/20 flex gap-2">
					<Button
						size="sm"
						className="flex-1 h-8 text-xs"
						disabled={isBusy}
						onClick={() => approveMutation.mutate({ entityId: data.entityId })}
					>
						{approveMutation.isPending ? <Spinner className="size-3 mr-1.5" /> : <CheckIcon className="size-3 mr-1.5" />}
						批准
					</Button>
					<Button
						size="sm"
						variant="destructive"
						className="flex-1 h-8 text-xs"
						disabled={isBusy}
						onClick={() => rejectMutation.mutate({ entityId: data.entityId, reason: "通过 Agent 拒绝" })}
					>
						{rejectMutation.isPending ? <Spinner className="size-3 mr-1.5" /> : <XIcon className="size-3 mr-1.5" />}
						拒绝
					</Button>
				</div>
			)}
		</div>
	);
}

// ── 汇报卡片 ──────────────────────────────────────────────

export function ReportCard({ data }: { data: ReportCardData }) {
	const progress = data.progress ? Number.parseInt(data.progress) : null;
	const riskCfg  = data.riskLevel ? RISK_CONFIG[data.riskLevel] : null;

	return (
		<div className="rounded-xl border overflow-hidden bg-card">
			<div className="px-3.5 py-2.5 flex items-center gap-2 border-b bg-emerald-50/60 dark:bg-emerald-950/20">
				<TrendingUpIcon className="size-4 text-emerald-600 shrink-0" />
				<span className="text-xs font-semibold text-foreground flex-1 truncate">{data.title}</span>
				{riskCfg && (
					<span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${riskCfg.cls}`}>
						{riskCfg.label}
					</span>
				)}
			</div>

			{/* 进度条 */}
			{progress != null && (
				<div className="px-3.5 pt-3 pb-1">
					<div className="flex items-center justify-between mb-1.5">
						<span className="text-xs text-muted-foreground">整体进度</span>
						<span className="text-sm font-bold">{progress}%</span>
					</div>
					<div className="h-2 rounded-full bg-muted overflow-hidden">
						<div
							className={`h-full rounded-full transition-all ${
								progress >= 80 ? "bg-emerald-500"
								: progress >= 50 ? "bg-blue-500"
								: "bg-amber-500"
							}`}
							style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
						/>
					</div>
				</div>
			)}

			<div className="px-3.5 py-2 space-y-0">
				{data.weeklyVelocity && <Row label="本周速度" value={data.weeklyVelocity} />}
				{data.completedMilestones && <Row label="已完成" value={data.completedMilestones} />}
				{data.blockers && (
					<Row
						label="阻塞项"
						value={<span className="text-amber-600 dark:text-amber-400">{data.blockers}</span>}
					/>
				)}
				{data.plannedCompletion && <Row label="预计完成" value={data.plannedCompletion} />}
			</div>
		</div>
	);
}

// ── 风险预测卡片 ──────────────────────────────────────────

export function RiskCard({ data }: { data: RiskCardData }) {
	const cfg     = RISK_CONFIG[data.riskLevel] ?? RISK_CONFIG.low;
	const confPct = Math.round(data.confidence * 100);

	return (
		<div className="rounded-xl border overflow-hidden bg-card">
			{/* 风险等级头部 */}
			<div className={`px-3.5 py-2.5 border-b flex items-center gap-2 ${cfg.cls}`}>
				<ShieldAlertIcon className="size-4 shrink-0" />
				<span className="text-xs font-bold flex-1">{cfg.label}</span>
				<span className="text-[10px] opacity-70">AI 置信 {confPct}%</span>
			</div>

			<div className="px-3.5 py-3 space-y-3">
				{/* 截止日期风险 */}
				{data.deadlineRisk.hasDeadline && (
					<div className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
						data.deadlineRisk.isAtRisk
							? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
							: "bg-muted/40 text-muted-foreground"
					}`}>
						<ClockIcon className="size-3.5 shrink-0" />
						<span>
							截止 {data.deadlineRisk.deadline}
							{data.deadlineRisk.daysRemaining != null && (
								<span className="ml-1 font-medium">
									{data.deadlineRisk.daysRemaining < 0
										? `（逾期 ${Math.abs(data.deadlineRisk.daysRemaining)} 天）`
										: `（还剩 ${data.deadlineRisk.daysRemaining} 天）`}
								</span>
							)}
						</span>
					</div>
				)}

				{/* 风险因素 */}
				{data.riskFactors.length > 0 && (
					<div>
						<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">风险因素</p>
						<ul className="space-y-1">
							{data.riskFactors.map((f) => (
								<li key={f} className="flex items-start gap-1.5 text-xs">
									<AlertTriangleIcon className="size-3 mt-0.5 shrink-0 text-orange-500" />
									{f}
								</li>
							))}
						</ul>
					</div>
				)}

				{/* 预测结果 */}
				<p className="text-xs text-muted-foreground leading-relaxed">
					<span className="font-medium text-foreground">预测：</span>
					{data.predictedOutcome}
				</p>

				{/* 建议操作 */}
				{data.suggestedActions.length > 0 && (
					<div>
						<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">建议操作</p>
						<ul className="space-y-1">
							{data.suggestedActions.map((a) => (
								<li key={a} className="flex items-start gap-1.5 text-xs">
									<ArrowRightIcon className="size-3 mt-0.5 shrink-0 text-emerald-500" />
									{a}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}

// ── 时间线 Diff 卡片 ──────────────────────────────────────

export function TimelineDiffCard({ data }: { data: TimelineDiffCardData }) {
	const DeltaIcon = data.progressDelta == null ? MinusIcon
		: data.progressDelta > 0 ? TrendingUpIcon : TrendingDownIcon;
	const deltaColor = data.progressDelta == null ? "text-muted-foreground"
		: data.progressDelta > 0 ? "text-emerald-600 dark:text-emerald-400"
		: "text-red-500 dark:text-red-400";

	return (
		<div className="rounded-xl border overflow-hidden bg-card">
			<div className="px-3.5 py-2.5 flex items-center gap-2 border-b bg-violet-50/60 dark:bg-violet-950/20">
				<SparklesIcon className="size-4 text-violet-500 shrink-0" />
				<span className="text-xs font-semibold text-foreground flex-1">变化分析</span>
				{data.progressDelta != null && (
					<span className={`flex items-center gap-0.5 text-xs font-bold ${deltaColor}`}>
						<DeltaIcon className="size-3.5" />
						{data.progressDelta > 0 ? "+" : ""}{data.progressDelta}%
					</span>
				)}
			</div>

			<div className="px-3.5 py-3 space-y-3">
				{/* 摘要 */}
				<p className="text-xs text-foreground leading-relaxed">{data.summary}</p>

				{/* 变更列表 */}
				{data.changes.length > 0 && (
					<div className="space-y-1.5">
						{data.changes.map((c, i) => (
							<div key={i} className="flex items-start gap-2 text-xs">
								<span className={`mt-0.5 size-1.5 rounded-full shrink-0 ${
									c.significance === "critical" ? "bg-red-500"
									: c.significance === "high" ? "bg-orange-500"
									: c.significance === "medium" ? "bg-amber-500"
									: "bg-muted-foreground"
								}`} />
								<span className={`font-medium min-w-[60px] ${SIG_COLORS[c.significance]}`}>
									{c.field}
								</span>
								<span className="text-muted-foreground line-through truncate max-w-[60px]">{c.before ?? "—"}</span>
								<ArrowRightIcon className="size-3 mt-0.5 shrink-0 text-muted-foreground/50" />
								<span className="text-foreground truncate flex-1">{c.after ?? "—"}</span>
							</div>
						))}
					</div>
				)}

				{/* 风险信号 */}
				{data.riskSignals.length > 0 && (
					<div className="rounded-lg bg-amber-50/60 dark:bg-amber-950/20 px-2.5 py-2 space-y-1">
						{data.riskSignals.map((s) => (
							<div key={s} className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
								<AlertTriangleIcon className="size-3 shrink-0" />
								{s}
							</div>
						))}
					</div>
				)}

				{/* 建议 */}
				{data.recommendation && (
					<p className="text-xs text-muted-foreground italic border-l-2 border-violet-300 dark:border-violet-700 pl-2">
						{data.recommendation}
					</p>
				)}
			</div>
		</div>
	);
}

// ── 实体列表卡片 ──────────────────────────────────────────

export function EntityListCard({ data }: { data: EntityListCardData }) {
	return (
		<div className="rounded-xl border overflow-hidden bg-card">
			<div className="px-3.5 py-2.5 border-b bg-muted/30 flex items-center justify-between">
				<span className="text-xs font-semibold">
					{data.filterLabel ?? "事项列表"}
				</span>
				<span className="text-[10px] text-muted-foreground">{data.totalCount} 条</span>
			</div>
			<ul className="divide-y">
				{data.items.map((item) => (
					<li key={item.id} className="px-3.5 py-2 flex items-center gap-2">
						<div className="flex-1 min-w-0">
							<p className="text-xs font-medium truncate">{item.title}</p>
							<p className="text-[10px] text-muted-foreground">
								{item.type} · {new Date(item.updatedAt).toLocaleDateString("zh-CN")}
							</p>
						</div>
						<Badge
							status={
								item.status === "approved" || item.status === "completed" ? "success"
								: item.status === "rejected" ? "error"
								: item.status === "pending" ? "warning"
								: "info"
							}
							className="h-4 rounded-sm px-1.5 text-[10px] shrink-0"
						>
							{item.status}
						</Badge>
					</li>
				))}
			</ul>
		</div>
	);
}

// ── 操作结果卡片 ──────────────────────────────────────────

export function ActionResultCard({ data }: { data: ActionResultCardData }) {
	const isSuccess = data.success;

	return (
		<div className={`rounded-xl border px-3.5 py-3 flex items-start gap-3 ${
			isSuccess
				? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900"
				: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
		}`}>
			<div className={`flex size-6 shrink-0 items-center justify-center rounded-full mt-0.5 ${
				isSuccess ? "bg-emerald-500" : "bg-red-500"
			}`}>
				{isSuccess
					? <CheckIcon className="size-3.5 text-white" />
					: <XIcon className="size-3.5 text-white" />
				}
			</div>
			<div className="flex-1 min-w-0">
				<p className={`text-xs font-semibold ${isSuccess ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
					{data.message}
				</p>
				{data.fromStatus && data.toStatus && (
					<div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
						<span className="line-through">{data.fromStatus}</span>
						<ArrowRightIcon className="size-3" />
						<Badge
							status={data.toStatus === "approved" ? "success" : data.toStatus === "rejected" ? "error" : "info"}
							className="h-3.5 rounded-sm px-1 text-[9px]"
						>
							{data.toStatus}
						</Badge>
					</div>
				)}
			</div>
		</div>
	);
}

// ── 里程碑图标 ────────────────────────────────────────────

export function MilestoneIcon() {
	return <FlagIcon className="size-3.5 text-emerald-500" />;
}

// ── 通用 AgentCard 路由器 ─────────────────────────────────

export function AgentCard({
	card,
	onApprovalAction,
}: {
	card: AgentUICard;
	onApprovalAction?: (action: "approved" | "rejected") => void;
}) {
	switch (card.type) {
		case "approval_card":
			return <ApprovalCard data={card.data} onAction={onApprovalAction} />;
		case "report_card":
			return <ReportCard data={card.data} />;
		case "risk_card":
			return <RiskCard data={card.data} />;
		case "timeline_diff":
			return <TimelineDiffCard data={card.data} />;
		case "entity_list":
			return <EntityListCard data={card.data} />;
		case "action_result":
			return <ActionResultCard data={card.data} />;
		default:
			return null;
	}
}

// ── 辅助组件 ──────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-baseline gap-2 py-1 border-b border-border/40 last:border-0">
			<span className="text-[11px] text-muted-foreground min-w-[52px] shrink-0">{label}</span>
			<span className="text-xs font-medium flex-1 min-w-0">{value}</span>
		</div>
	);
}
