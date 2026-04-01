---
name: flowmail
description: Connect to Flowmail to manage email-driven business workflows — approvals, report tracking, timeline events, AI risk prediction, and entity management.
metadata:
  {
    "openclaw":
      {
        "emoji": "📬",
        "homepage": "https://flowmail.ai",
        "requires": { "env": ["FLOWMAIL_API_TOKEN"] },
        "primaryEnv": "FLOWMAIL_API_TOKEN"
      }
  }
---

# Flowmail Skill

Flowmail is an email-native business execution platform. It automatically converts emails into structured business items (approvals, reports, issues) and tracks their progress with AI-powered analysis.

## Quick Start

1. Log in to Flowmail → Settings → Agent / MCP → Create API Token
2. Copy the token (shown only once)
3. Configure your MCP client (see below)

## Configuration

### OpenClaw (openclaw.json)

```json
{
  "mcp": {
    "servers": {
      "flowmail": {
        "url": "https://app.flowmail.ai/mcp/streamable-http",
        "headers": {
          "Authorization": "Bearer fm_your_token_here"
        }
      }
    }
  }
}
```

### Cursor / Claude Desktop (.mcp.json)

```json
{
  "mcpServers": {
    "flowmail": {
      "url": "https://app.flowmail.ai/mcp/streamable-http",
      "headers": {
        "Authorization": "Bearer fm_your_token_here"
      }
    }
  }
}
```

### Environment Variable

```bash
export FLOWMAIL_API_TOKEN="fm_your_token_here"
```

## Authentication

All MCP tool calls require a valid API Token in the `Authorization: Bearer <token>` header. The token is scoped to an organization — you don't need to pass `organizationId` to any tool; it's automatically resolved from the token.

## Available Tools

### Entity Management

- **`list_entities`** — List structured business entities (approvals, reports, issues, feedback). Supports filters by type, status, and limit.
- **`get_entity`** — Get full details of any entity including timeline of events and related email threads.
- **`update_entity_status`** — Update the status of a business entity (e.g., mark as completed, in_progress, blocked). Records reason in timeline.

### Approval Management

- **`list_pending_approvals`** — List all pending approval requests for the organization.
- **`approve_request`** — Approve a pending request. Optionally include a comment.
- **`reject_request`** — Reject a pending request with a required reason.

### Report Tracking

- **`list_reports`** — List report entities, filterable by status.
- **`get_report_summary`** — Get AI-generated summary of a report including extracted fields.

### Email

- **`list_email_connections`** — List all connected email accounts.
- **`search_emails`** — Search emails by keyword, sender, or subject. Returns matching threads with their associated entities.

### Timeline

- **`get_entity_timeline`** — Get the full chronological timeline of events for an entity. Filter by event types.
- **`add_timeline_event`** — Add a manual event (note, milestone, action_taken, status_changed, ai_summary, email_sent). Supports arbitrary metadata.
- **`get_timeline_diff`** — AI-powered semantic diff between two points in a timeline.

### AI Analysis

- **`predict_entity_risk`** — AI-powered risk prediction. Returns risk level, factors, deadline risk, and suggested actions.

## Callback Endpoint

When executing multi-step tasks, agents can report results back:

```
POST https://app.flowmail.ai/api/agent/callback
Authorization: Bearer fm_your_token_here
Content-Type: application/json

{
  "entityId": "...",
  "taskId": "optional-tracking-id",
  "status": "success",
  "summary": "Completed: scheduled meeting with 3 attendees",
  "actions": [
    { "tool": "add_calendar_event", "status": "success", "result": {} }
  ]
}
```

This adds a timeline event to the entity so the user sees the outcome in Flowmail's UI (tagged as "via openclaw").

## Usage Examples

### Check pending approvals

```
User: What approvals are waiting for me?
Agent: [calls list_pending_approvals] → returns list
```

### Approve a request

```
User: Approve the marketing budget request from Li Ming
Agent: [calls list_pending_approvals] → [calls approve_request with entityId]
```

### Search and analyze

```
User: Find emails about the Q3 report and summarize progress
Agent: [calls search_emails with query "Q3 report"] →
       [calls get_entity for the matching entity] →
       [calls get_report_summary]
```

### Risk assessment

```
User: Is the server migration project at risk?
Agent: [calls list_entities to find entity] → [calls predict_entity_risk]
```

## Flowmail Sidebar vs MCP Agent: When to Use Which

| Dimension | Flowmail Sidebar | OpenClaw / MCP |
|-----------|-----------------|----------------|
| Setup | Built-in, zero config | Requires API Token |
| UI | Rich cards, streaming | Text-only (agent decides) |
| Cross-system | Flowmail only | Flowmail + Calendar + Slack + GitHub + 3,200+ Skills |
| Execution | Cloud, managed | Local or cloud, user-controlled |
| Best for | Quick in-app actions | Complex multi-system workflows |

## Notes

- All write operations (approve/reject/update) are recorded in the entity timeline with `via: "mcp"` metadata
- Entity IDs are CUIDs — use list/search tools first to find the right ID
- AI-powered tools (get_timeline_diff, predict_entity_risk) require an AI provider key configured on the Flowmail server
