#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources/index.js";
import { registerApprovalTools } from "./tools/approvals.js";
import { registerEntityTools } from "./tools/entities.js";
import { registerReportTools } from "./tools/reports.js";

const server = new McpServer({
	name: "flowmail-mcp",
	version: "0.1.0",
});

registerEntityTools(server);
registerApprovalTools(server);
registerReportTools(server);
registerResources(server);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("Flowmail MCP Server running on stdio");
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
