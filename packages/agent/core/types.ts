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

export interface MemoryEntry {
	id: string;
	category: MemoryCategory;
	scope: MemoryScope;
	scopeId?: string | null;
	content: string;
	metadata?: Record<string, unknown>;
	importance: number;
	createdAt: Date;
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
