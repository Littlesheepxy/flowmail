import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerResources(server: McpServer) {
	server.resource(
		"status",
		"flowmail://status",
		{ description: "Flowmail system status", mimeType: "application/json" },
		async () => ({
			contents: [
				{
					uri: "flowmail://status",
					mimeType: "application/json",
					text: JSON.stringify({
						status: "operational",
						version: "0.1.0",
					}),
				},
			],
		}),
	);

	server.resource(
		"agent-guide",
		"flowmail://agent-guide",
		{
			description: "How to use Flowmail MCP tools",
			mimeType: "text/markdown",
		},
		async () => ({
			contents: [
				{
					uri: "flowmail://agent-guide",
					mimeType: "text/markdown",
					text: `# Flowmail Agent Guide

Flowmail converts emails into structured business workflows.

## Available Tools
- **list_entities** — List structured entities (approvals, reports)
- **get_entity** — Get entity details with timeline
- **approve_request** — Approve a pending approval
- **reject_request** — Reject a pending approval
- **list_pending_approvals** — List items awaiting approval
- **list_reports** — List report entities
`,
				},
			],
		}),
	);
}
