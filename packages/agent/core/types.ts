import type { ToolSet } from "@repo/ai";

// ─── Memory System Types ───

export const MEMORY_CATEGORIES = {
	user_preference: "user_preference",
	contact_profile: "contact_profile",
	project_context: "project_context",
	behavior_pattern: "behavior_pattern",
	decision_record: "decision_record",
	classification_learning: "classification_learning",
	org_insight: "org_insight",
} as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[keyof typeof MEMORY_CATEGORIES];

export const MEMORY_SCOPES = {
	org: "org",
	user: "user",
	contact: "contact",
	project: "project",
} as const;

export type MemoryScope = (typeof MEMORY_SCOPES)[keyof typeof MEMORY_SCOPES];

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
	user_preference: "用户偏好",
	contact_profile: "联系人画像",
	project_context: "项目上下文",
	behavior_pattern: "行为模式",
	decision_record: "决策记录",
	classification_learning: "分类学习",
	org_insight: "组织洞察",
};

// ─── Memory Object Types (structured knowledge) ───

export const MEMORY_OBJECT_TYPES = {
	self: "self",
	person: "person",
	project: "project",
	event: "event",
	preference: "preference",
	decision: "decision",
} as const;

export type MemoryObjectType = string;

export interface MemoryObjectEntry {
	id: string;
	objectType: string;
	objectId: string;
	name: string;
	attributes: Record<string, unknown>;
	relations?: MemoryObjectRelation[];
	lastUpdatedAt: Date;
	createdAt: Date;
}

export interface MemoryObjectRelation {
	type: string;
	targetType: string;
	targetId: string;
	label?: string;
}

export interface ObjectTypeTemplate {
	label: string;
	icon: string;
	suggestedFields: string[];
	fieldLabels: Record<string, string>;
}

export const OBJECT_TYPE_TEMPLATES: Record<string, ObjectTypeTemplate> = {
	self: {
		label: "我的画像",
		icon: "UserCircle",
		suggestedFields: ["role", "writing_style", "work_habits", "tone_preference", "signature", "language", "processing_preferences"],
		fieldLabels: {
			role: "角色",
			writing_style: "写作风格",
			work_habits: "工作习惯",
			tone_preference: "语气偏好",
			signature: "签名",
			language: "语言",
			processing_preferences: "处理偏好",
		},
	},
	person: {
		label: "联系人",
		icon: "User",
		suggestedFields: ["role", "company", "communication_style", "sensitivity", "relationship", "preferences", "habits"],
		fieldLabels: {
			role: "职务",
			company: "公司",
			communication_style: "沟通风格",
			sensitivity: "敏感点",
			relationship: "关系",
			preferences: "偏好",
			habits: "习惯",
		},
	},
	project: {
		label: "项目",
		icon: "Folder",
		suggestedFields: ["status", "deadline", "owner", "participants", "progress", "budget", "key_context"],
		fieldLabels: {
			status: "状态",
			deadline: "截止日期",
			owner: "负责人",
			participants: "参与者",
			progress: "进展",
			budget: "预算",
			key_context: "关键背景",
		},
	},
	event: {
		label: "事件",
		icon: "Calendar",
		suggestedFields: ["happened_at", "participants", "impact", "follow_up", "related_project"],
		fieldLabels: {
			happened_at: "发生时间",
			participants: "相关人",
			impact: "影响",
			follow_up: "后续动作",
			related_project: "关联项目",
		},
	},
	preference: {
		label: "规则偏好",
		icon: "Settings",
		suggestedFields: ["rule", "context", "scope", "examples"],
		fieldLabels: {
			rule: "规则",
			context: "适用场景",
			scope: "适用范围",
			examples: "示例",
		},
	},
	decision: {
		label: "决策记录",
		icon: "Gavel",
		suggestedFields: ["decision", "reason", "context", "outcome", "decided_at", "related_entities"],
		fieldLabels: {
			decision: "决策",
			reason: "原因",
			context: "背景",
			outcome: "结果",
			decided_at: "决定时间",
			related_entities: "关联事项",
		},
	},
};

/**
 * 记忆条目的记录来源，区分"纠正"和"确认"两类信号
 * correction: 用户否定了 Agent 的操作/判断
 * confirmation: 用户接受/认可了 Agent 的操作/判断（验证已有方向正确）
 * observation: Agent 主动观察到的信息，无用户明确反馈
 */
export type MemoryOrigin = "correction" | "confirmation" | "observation";

export interface MemoryEntry {
	id: string;
	category: MemoryCategory;
	scope: MemoryScope;
	scopeId?: string | null;
	content: string;
	metadata?: Record<string, unknown>;
	importance: number;
	createdAt: Date;
	origin?: MemoryOrigin;
}

export interface RecallOptions {
	organizationId: string;
	categories?: MemoryCategory[];
	scope?: { type: MemoryScope; id: string };
	query?: string;
	limit?: number;
	minImportance?: number;
}

// ─── Page & Agent Types ───

export interface PageContext {
	route?: string;
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
	activeFilters?: { type?: string; status?: string; search?: string };
}

export interface ToolContext {
	organizationId: string;
	userId: string;
	entityId?: string;
}

export interface AgentConfig {
	systemPrompt: string;
	tools: ToolSet;
	maxSteps: number;
}
