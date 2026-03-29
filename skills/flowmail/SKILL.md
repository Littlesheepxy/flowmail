---
name: flowmail
description: Connect to Flowmail to manage email-driven business workflows — approvals, report tracking, and entity management. Use when user wants to check pending approvals, view reports, approve/reject requests, or track business items extracted from emails.
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

Flowmail is an email-native business execution platform. It automatically converts emails into structured business items (approvals, reports, issues) and tracks their progress.

## Configuration

Set these environment variables (or configure via OpenClaw's skills config):

- `FLOWMAIL_API_TOKEN` — Your Flowmail API token (get from Settings > API)
- `FLOWMAIL_ORG_ID` — Your organization ID
- `FLOWMAIL_BASE_URL` — API base URL (default: `https://app.flowmail.ai`)

## Available Tools (via MCP)

Connect to the Flowmail MCP server at `{FLOWMAIL_BASE_URL}/mcp`.

### Approval Management

- **`list_pending_approvals`** — List all pending approval requests for the organization
- **`approve_request`** — Approve a request (sends notification email to requester)
- **`reject_request`** — Reject a request with a required reason
- **`get_entity`** — Get full details of any entity including timeline

### Report Tracking

- **`list_reports`** — List report entities, filterable by status or reporter
- **`get_report_summary`** — Get AI-generated summary of a report thread
- **`flag_report_risk`** — Mark a report as at-risk with description

### General Entity Management

- **`list_entities`** — List all entities (approvals/reports/issues), with filters
- **`update_entity_status`** — Manually update an entity's status
- **`search_entities`** — Semantic search across all entities

### Email Connection

- **`list_email_connections`** — List connected email accounts for the org
- **`process_email_now`** — Manually trigger AI processing of a specific email

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
