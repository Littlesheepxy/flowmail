/**
 * Agent 消息协议（Blocks 模型）
 *
 * AI 的回复由一系列有序 Block 组成，前端按顺序渲染。
 * Block 可以是文本块（摘要、解释、建议）或结构化卡片块（审批、风险、diff）。
 * 这样既有文字总结，也有可交互的 GUI。
 */

// ── 文本块类型 ───────────────────────────────────────────

export interface TextBlock {
	type: "text";
	content: string;
}

export interface SuggestionBlock {
	type: "suggestions";
	items: string[];
}

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

// ── Block 联合类型（前端渲染的最小单元） ──────────────────

export type AgentBlock =
	| TextBlock
	| SuggestionBlock
	| { type: "approval_card";    data: ApprovalCardData }
	| { type: "report_card";      data: ReportCardData }
	| { type: "risk_card";        data: RiskCardData }
	| { type: "timeline_diff";    data: TimelineDiffCardData }
	| { type: "entity_list";      data: EntityListCardData }
	| { type: "action_confirm";   data: ActionConfirmCardData }
	| { type: "action_result";    data: ActionResultCardData };

/** 向后兼容 — AgentCards.tsx 仍用这个名字做卡片路由 */
export type AgentUICard = Exclude<AgentBlock, TextBlock | SuggestionBlock>;

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
