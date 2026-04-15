/**
 * Centralized EntityType → Chinese labels, colors, and icons.
 * Import this everywhere instead of duplicating type label maps.
 */

export interface EntityTypeConfig {
	label: string;
	color: string;
	bgColor: string;
	badgeStatus: "warning" | "success" | "error" | "info";
}

const TYPE_CONFIG: Record<string, EntityTypeConfig> = {
	APPROVAL: {
		label: "审批",
		color: "#f59e0b",
		bgColor: "bg-amber-50 dark:bg-amber-950/30",
		badgeStatus: "warning",
	},
	REPORT: {
		label: "汇报",
		color: "#3b82f6",
		bgColor: "bg-blue-50 dark:bg-blue-950/30",
		badgeStatus: "info",
	},
	ISSUE: {
		label: "问题",
		color: "#ef4444",
		bgColor: "bg-red-50 dark:bg-red-950/30",
		badgeStatus: "error",
	},
	FEEDBACK: {
		label: "反馈",
		color: "#10b981",
		bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
		badgeStatus: "success",
	},
	NOISE: {
		label: "已过滤",
		color: "#94a3b8",
		bgColor: "bg-slate-50 dark:bg-slate-950/30",
		badgeStatus: "info",
	},
};

const FALLBACK: EntityTypeConfig = {
	label: "未知",
	color: "#6b7280",
	bgColor: "bg-gray-50 dark:bg-gray-950/30",
	badgeStatus: "info",
};

export function getEntityTypeConfig(type: string): EntityTypeConfig {
	return TYPE_CONFIG[type] ?? FALLBACK;
}

export function getEntityTypeLabel(type: string): string {
	return TYPE_CONFIG[type]?.label ?? type;
}

export function getEntityTypeBadgeStatus(type: string): "warning" | "success" | "error" | "info" {
	return TYPE_CONFIG[type]?.badgeStatus ?? "info";
}

export const STATUS_LABELS: Record<string, string> = {
	pending: "待处理",
	approved: "已批准",
	rejected: "已拒绝",
	cancelled: "已取消",
	in_progress: "进行中",
	completed: "已完成",
	overdue: "已逾期",
	received: "已收到",
	open: "待解决",
	blocked: "已阻塞",
	filtered: "已过滤",
};

export function getStatusLabel(status: string): string {
	return STATUS_LABELS[status] ?? status;
}

export const ALL_ENTITY_TYPES = [
	{ value: "APPROVAL", label: "审批", description: "审批请求、授权需求" },
	{ value: "REPORT", label: "汇报", description: "进度更新、周报、日报" },
	{ value: "ISSUE", label: "问题", description: "问题报告、故障、投诉" },
	{ value: "FEEDBACK", label: "反馈", description: "建议、反馈、评价" },
	{ value: "NOISE", label: "已过滤", description: "营销邮件、订阅通知、广告" },
] as const;
