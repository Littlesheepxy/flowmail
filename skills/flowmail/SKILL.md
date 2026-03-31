---
name: flowmail
description: Connect to Flowmail to manage email-driven business workflows — approvals, report tracking, timeline events, AI risk prediction, and entity management. Use when user wants to check pending approvals, view reports, approve/reject requests, track business items, analyze risks, or add timeline events.
metadata:
  {
    "openclaw":
      {
        "emoji": "📬",
        "homepage": "https://flowmail.ai",
        "requires": { "env": ["FLOWMAIL_API_TOKEN", "FLOWMAIL_ORG_ID"] },
        "primaryEnv": "FLOWMAIL_API_TOKEN"
      }
  }
---

# Flowmail Skill

Flowmail is an email-native business execution platform. It automatically converts emails into structured business items (approvals, reports, issues) and tracks their progress with AI-powered analysis.

## Configuration

Set these environment variables (or configure via OpenClaw's skills config):

- `FLOWMAIL_API_TOKEN` — Your Flowmail API token (get from Settings > API)
- `FLOWMAIL_ORG_ID` — Your organization ID
- `FLOWMAIL_BASE_URL` — API base URL (default: `https://app.flowmail.ai`)

## MCP Connection

Connect to the Flowmail MCP server at `{FLOWMAIL_BASE_URL}/mcp`.

For Cursor / Claude Desktop, add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "flowmail": {
      "url": "https://app.flowmail.ai/mcp"
    }
  }
}
```

## Available Tools

### Entity Management

- **`list_entities`** — List structured business entities (approvals, reports, issues, feedback) for an organization. Supports filters by type, status, and limit.
- **`get_entity`** — Get full details of any entity including timeline of events and related email threads.
- **`update_entity_status`** — Update the status of a business entity (e.g., mark as completed, in_progress, blocked). Records reason in timeline.

### Approval Management

- **`list_pending_approvals`** — List all pending approval requests for the organization.
- **`approve_request`** — Approve a pending request. Optionally include a comment. Sends notification and records in timeline.
- **`reject_request`** — Reject a pending request with a required reason. Sends notification and records in timeline.

### Report Tracking

- **`list_reports`** — List report entities, filterable by status.
- **`get_report_summary`** — Get AI-generated summary of a report including extracted fields.

### Timeline Management

- **`get_entity_timeline`** — Get the full chronological timeline of events for an entity. Filter by event types (email_received, email_sent, status_changed, action_taken, ai_summary, milestone, note).
- **`add_timeline_event`** — Add a manual event to an entity's timeline (note, milestone, action_taken, status_changed, ai_summary). Supports arbitrary metadata.
- **`get_timeline_diff`** — AI-powered semantic diff between two points in a timeline. Shows what changed, risk signals, progress delta, and recommendations.

### AI Analysis

- **`predict_entity_risk`** — AI-powered risk prediction for a business entity. Analyzes timeline history, extracted fields, and current status. Returns risk level, factors, deadline risk, and suggested actions.

### Email Connections

- **`list_email_connections`** — List all connected email accounts for the organization.

## Callback / Results Reporting

When OpenClaw executes complex multi-step tasks on behalf of Flowmail, it can report results back via:

```
POST {FLOWMAIL_BASE_URL}/api/agent/callback
Content-Type: application/json
Authorization: Bearer {FLOWMAIL_API_TOKEN}

{
  "entityId": "...",
  "taskId": "...",
  "status": "success" | "error" | "partial",
  "summary": "Completed: scheduled meeting with 3 attendees",
  "actions": [
    { "tool": "add_calendar_event", "status": "success", "result": {...} }
  ]
}
```

This adds a timeline event to the entity so the user sees the outcome in Flowmail's UI.

## Usage Examples

### Check what needs approval today

```
User: What approvals are waiting for me?
Agent: [calls list_pending_approvals] → returns list of pending items
```

### Approve a request

```
User: Approve the marketing budget request from Li Ming
Agent: [calls list_pending_approvals to find entity] →
       [calls approve_request with entityId and optional comment]
```

### Weekly report review

```
User: Summarize this week's team reports
Agent: [calls list_reports with status filter] →
       [calls get_report_summary for each] →
       [synthesizes summary]
```

### Track progress changes

```
User: What changed on the Q3 roadmap since last week?
Agent: [calls get_entity to find entityId] →
       [calls get_timeline_diff with date range] →
       [presents semantic diff with risk signals]
```

### Risk assessment

```
User: Is the server migration project at risk?
Agent: [calls list_entities to find entity] →
       [calls predict_entity_risk] →
       [presents risk level, factors, and suggested actions]
```

### Add a milestone

```
User: Mark the design phase as complete for Project Alpha
Agent: [calls list_entities to find entity] →
       [calls add_timeline_event with type "milestone"]
```

## Integration with OpenClaw Gmail

When used alongside OpenClaw's built-in Gmail hook, Flowmail processes
incoming emails automatically. Configure in `openclaw.json`:

```json5
{
  hooks: {
    enabled: true,
    presets: ["gmail"],
    mappings: [
      {
        match: { path: "gmail" },
        action: "agent",
        wakeMode: "now",
        name: "FlowmailProcessor",
        messageTemplate: "New email received. Process with Flowmail if it's an approval request or report update: From: {{messages[0].from}} Subject: {{messages[0].subject}} Body: {{messages[0].body}}",
        model: "anthropic/claude-opus-4-5",
        deliver: false
      }
    ]
  }
}
```

## Notes

- All write operations (approve/reject/update) require user confirmation unless running in autonomous mode
- Entity IDs are UUIDs — use list/search tools first to find the right ID
- Approval notifications are sent automatically when approve_request or reject_request succeeds
- Timeline events from MCP tools are tagged with `via: "mcp"` in metadata for origin tracking
- AI-powered tools (get_timeline_diff, predict_entity_risk) require an AI provider key configured on the server
