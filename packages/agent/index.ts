export { ToolRegistry } from "./core/tool-registry";
export { buildSystemPrompt, buildAgentConfig } from "./core/planner";
export { MemoryManager } from "./memory/manager";
export { FlowmailMCPClient } from "./mcp/client";

export { createEntityTools } from "./tools/entity-tools";
export { createAnalysisTools } from "./tools/analysis-tools";
export { createEmailTools } from "./tools/email-tools";
export { createInboxTools } from "./tools/inbox-tools";
export { createAttachmentTools } from "./tools/attachment-tools";
export {
	createWebSearchTool,
	createSummarizeThreadTool,
	createCompareEntitiesTool,
	createReminderTool,
} from "./tools/advanced-tools";
export { createSandboxTools } from "./tools/sandbox-tools";
export { createReplyTools } from "./tools/reply-tools";
export { createMemoryTools } from "./tools/memory-tools";
export { createViewTools } from "./tools/view-tools";
export { createCategoryTools } from "./tools/category-tools";

export {
	suggestCategoriesFromInbox,
	SAMPLE_CATEGORIES,
	SuggestedCategorySchema,
	CategorySuggestionSchema,
	type SuggestedCategory,
	type CategorySuggestion,
	type InboxSampleEmail,
} from "./lib/category-suggester";

export {
	ViewSpecSchema,
	ViewBlockSchema,
	VIEW_COMPONENT_DOCS,
	type ViewSpec,
	type ViewBlock,
	type SummaryBlock,
	type KpiCardsBlock,
	type TodoListBlock,
	type TimelineBlock,
	type TableBlock,
	type QuickActionsBlock,
} from "./views/schema";

export {
	MEMORY_CATEGORIES,
	MEMORY_SCOPES,
	CATEGORY_LABELS,
	MEMORY_OBJECT_TYPES,
	OBJECT_TYPE_TEMPLATES,
} from "./core/types";

export type {
	PageContext,
	ToolContext,
	AgentConfig,
	MemoryEntry,
	MemoryCategory,
	MemoryScope,
	MemoryOrigin,
	RecallOptions,
	MemoryObjectType,
	MemoryObjectEntry,
	MemoryObjectRelation,
	ObjectTypeTemplate,
} from "./core/types";

export type { MCPClientConfig, MCPServerInfo, PluginManifest, PluginLoader } from "./mcp/types";

export type {
	WriteMemoryParams,
	RecordClassificationParams,
	RecordInsightParams,
	RecordDecisionParams,
	RecordContactProfileParams,
	RecordUserProfileParams,
	RecordFeedbackParams,
	RecordProjectContextParams,
	RecordReferenceParams,
	UpsertObjectParams,
	UpsertObjectResult,
} from "./memory/manager";
