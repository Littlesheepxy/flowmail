export { buildAgentConfig, buildSystemPrompt } from "./core/planner";
export { ToolRegistry } from "./core/tool-registry";
export type {
	AgentConfig,
	MemoryCategory,
	MemoryEntry,
	MemoryScope,
	PageContext,
	RecallOptions,
	ToolContext,
} from "./core/types";
export {
	CATEGORY_LABELS,
	MEMORY_CATEGORIES,
	MEMORY_SCOPES,
} from "./core/types";
export { FlowmailMCPClient } from "./mcp/client";
export type {
	MCPClientConfig,
	MCPServerInfo,
	PluginLoader,
	PluginManifest,
} from "./mcp/types";
export type {
	RecordClassificationParams,
	RecordContactProfileParams,
	RecordDecisionParams,
	RecordInsightParams,
	WriteMemoryParams,
} from "./memory/manager";
export { MemoryManager } from "./memory/manager";
export { createAnalysisTools } from "./tools/analysis-tools";
export { createClassificationTools } from "./tools/classification-tools";
export { createEmailTools } from "./tools/email-tools";
export { createEntityTools } from "./tools/entity-tools";
export { createInboxTools } from "./tools/inbox-tools";
