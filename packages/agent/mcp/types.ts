import type { ToolSet } from "@repo/ai";

export interface MCPClientConfig {
	serverUrl: string;
	transport: "stdio" | "sse" | "streamable-http";
	auth?: { type: "bearer"; token: string };
}

export interface MCPServerInfo {
	name: string;
	version: string;
	capabilities: string[];
}

export interface PluginManifest {
	id: string;
	name: string;
	description: string;
	version: string;
	mcpServerUrl?: string;
	tools: string[];
}

export interface PluginLoader {
	discover(): Promise<PluginManifest[]>;
	loadTools(pluginId: string): Promise<ToolSet>;
	unload(pluginId: string): Promise<void>;
}
