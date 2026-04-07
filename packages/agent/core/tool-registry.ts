import type { ToolSet } from "@repo/ai";
import type { ToolContext } from "./types";

export class ToolRegistry {
	private builtinTools: Map<string, ToolSet[string]> = new Map();
	private mcpTools: Map<string, ToolSet[string]> = new Map();

	registerBuiltin(tools: ToolSet): void {
		for (const [name, t] of Object.entries(tools)) {
			this.builtinTools.set(name, t);
		}
	}

	async registerMCP(_serverUrl: string): Promise<void> {
		// Reserved for future MCP client integration via @ai-sdk/mcp
	}

	getTools(_context: ToolContext): ToolSet {
		const result: ToolSet = {};

		for (const [name, t] of this.builtinTools) {
			result[name] = t;
		}

		for (const [name, t] of this.mcpTools) {
			result[name] = t;
		}

		return result;
	}

	getToolNames(): string[] {
		return [...this.builtinTools.keys(), ...this.mcpTools.keys()];
	}
}
