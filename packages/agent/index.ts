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
	MEMORY_CATEGORIES,
	MEMORY_SCOPES,
	CATEGORY_LABELS,
} from "./core/types";

export type {
	PageContext,
	ToolContext,
	AgentConfig,
	MemoryEntry,
	MemoryCategory,
	MemoryScope,
	RecallOptions,
} from "./core/types";

export type { MCPClientConfig, MCPServerInfo, PluginManifest, PluginLoader } from "./mcp/types";

export type {
	WriteMemoryParams,
	RecordClassificationParams,
	RecordInsightParams,
	RecordDecisionParams,
	RecordContactProfileParams,
} from "./memory/manager";
