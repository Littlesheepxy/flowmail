import type { ToolSet } from "@repo/ai";
import type { MCPClientConfig, MCPServerInfo } from "./types";

/**
 * Flowmail MCP Client — future integration point for @ai-sdk/mcp.
 *
 * Currently a stub that returns empty tools. When implemented,
 * this will connect to external MCP servers and expose their
 * tools to the Agent via the ToolRegistry.
 */
export class FlowmailMCPClient {
	constructor(_config: MCPClientConfig) {}

	async connect(): Promise<MCPServerInfo> {
		return {
			name: "stub",
			version: "0.0.0",
			capabilities: [],
		};
	}

	async listTools(): Promise<ToolSet> {
		return {};
	}

	async disconnect(): Promise<void> {
		// no-op
	}
}
