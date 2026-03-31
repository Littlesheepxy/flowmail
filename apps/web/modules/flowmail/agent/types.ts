/**
 * Agent UI 卡片数据类型
 *
 * 卡片由工具返回的结构化数据驱动，前端根据 type 路由到对应 UI 组件。
 * 文本内容由 AI SDK 的 text parts 直接流式渲染为 Markdown，不经过此类型系统。
 */

// ── 结构化卡片数据 ───────────────────────────────────────

export interface ApprovalCardData {
	entityId: string;
	title: string;
	applicant?: string;
	amount?: string;
	purpose?: string;
	deadline?: string;
	urgency?: string;
	currentStatus: string;
}

export interface ReportCardData {
	entityId: string;
	title: string;
	progress?: string;
	weeklyVelocity?: string;
	blockers?: string;
	completedMilestones?: string;
	plannedCompletion?: string;
	riskLevel?: "low" | "medium" | "high" | "critical";
}

export interface RiskCardData {
	entityId: string;
	riskLevel: "low" | "medium" | "high" | "critical";
	riskFactors: string[];
	predictedOutcome: string;
	suggestedActions: string[];
	deadlineRisk: {
		hasDeadline: boolean;
		deadline?: string | null;
		daysRemaining?: number | null;
		isAtRisk: boolean;
	};
	confidence: number;
}

export interface TimelineDiffCardData {
	entityId: string;
	summary: string;
	changes: Array<{
		field: string;
		before: string | null;
		after: string | null;
		significance: "low" | "medium" | "high" | "critical";
	}>;
	riskSignals: string[];
	progressDelta: number | null;
	recommendation: string | null;
}

export interface EntityListCardData {
	items: Array<{
		id: string;
		title: string;
		type: string;
		status: string;
		aiConfidence?: number | null;
		updatedAt: string;
	}>;
	totalCount: number;
	filterLabel?: string;
}

export interface ActionConfirmCardData {
	entityId: string;
	action: "approve" | "reject" | "update_status" | "add_note";
	label: string;
	description?: string;
	destructive?: boolean;
}

export interface ActionResultCardData {
	success: boolean;
	action: string;
	message: string;
	fromStatus?: string;
	toStatus?: string;
}

// ── UI 卡片联合类型（工具结果 → 渲染组件） ───────────────

export type AgentUICard =
	| { type: "approval_card";    data: ApprovalCardData }
	| { type: "report_card";      data: ReportCardData }
	| { type: "risk_card";        data: RiskCardData }
	| { type: "timeline_diff";    data: TimelineDiffCardData }
	| { type: "entity_list";      data: EntityListCardData }
	| { type: "action_confirm";   data: ActionConfirmCardData }
	| { type: "action_result";    data: ActionResultCardData };

// ── 页面上下文（前端发送给后端的当前页面状态） ────────────

export interface PageContext {
	route: string;
	organizationId?: string;
	entityId?: string;
	entity?: {
		id: string;
		title: string;
		type: string;
		status: string;
		aiSummary?: string | null;
		extractedFields?: Record<string, unknown>;
		aiConfidence?: number | null;
	};
	timelinePreview?: Array<{
		type: string;
		content: string;
		createdAt: string;
	}>;
	activeFilters?: {
		type?: string;
		status?: string;
		search?: string;
	};
}
