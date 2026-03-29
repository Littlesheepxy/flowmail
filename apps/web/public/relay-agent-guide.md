# Relay Agent Integration Guide

> This document tells AI agents (OpenClaw, pi-agent, etc.) how to integrate with Relay — the execution management platform that gives AI agents the ability to make real phone calls and execute real-world tasks.

---

## 1. What is Relay?

Relay gives your AI agent a **phone** — and much more. You (the AI agent) handle reasoning; Relay handles execution, tracking, and analytics:

- **Voice calls** — real-time AI voice calls via shareable WebRTC links (sub-second latency)
- **Execution skills** — reusable playbooks for scenarios like meeting coordination, follow-ups, and interview confirmations
- **Task tracking** — full execution trace with live timeline (every step, tool, and message tracked)
- **Conversation analytics** — automatic transcription, AI summaries, and structured analysis for every call
- **Integrations** — connect calendars, email, IM, and more via MCP

**Your role**: Reason and orchestrate. **Relay's role**: Execute, track, and analyze.

> **Tagline**: Tell it once. Relay handles the rest.

---

## 2. Onboarding a New User

When a user first asks you to make a call, schedule a meeting, or follow up with someone:

### Step 1: Check if they have a Relay account

```
→ Ask: "I'll use Relay to handle this. Do you have a Relay account?"
→ If no: "Sign up at {SITE_URL}/sign-up — it takes 30 seconds, then come back."
→ If yes: proceed to Step 2 (no need to ask for Organization ID — the plugin handles auth automatically)
```

### Step 2: Get credentials (Plugin handles this automatically)

If the user has installed the **Relay OpenClaw Plugin** (`@relay-ai/openclaw-plugin`), credentials are handled automatically:

1. On first startup, the plugin prints a login URL in the terminal
2. User opens the URL, signs in, and clicks "Authorize"
3. Plugin receives the API key automatically — no manual copy-paste needed

> If `RELAY_API_KEY` is already set in the environment, this step is skipped.

**If not using the plugin**, the user can get an API key manually:
- Relay Console → Settings → API Keys → Create Key

### Step 3: Register your tools

Once you have credentials, tell Relay what tools you can use:

```json
// MCP call: register_integration
{
  "organizationId": "org_xxx",
  "type": "openclaw_agent",
  "name": "OpenClaw Agent",
  "description": "Personal AI agent with calendar, email, and IM access",
  "category": "execution",
  "tools": [
    { "name": "google_calendar.create_event", "description": "Create a calendar event" },
    { "name": "google_calendar.list_events", "description": "List upcoming events" },
    { "name": "gmail.send_email", "description": "Send an email" },
    { "name": "feishu.send_message", "description": "Send a Feishu message" }
  ]
}
```

### Step 4: Push user context

Help Relay understand the user's preferences:

```json
// MCP call: update_user_memory
{
  "userId": "user_xxx",
  "organizationId": "org_xxx",
  "memory": {
    "preferredName": "小阳",
    "timezone": "Asia/Shanghai",
    "workingHours": "09:00-18:00",
    "communicationStyle": "direct",
    "preferredLanguage": "zh",
    "calendarProvider": "google",
    "commonContacts": {
      "张总": { "email": "zhang@example.com", "feishu": "zhang_uid" }
    }
  }
}
```

---

## 3. Executing a Task

### Creating a task

```json
// MCP call: create_task
{
  "type": "interview-confirm",
  "organizationId": "org_xxx",
  "createdById": "user_xxx",
  "source": "openclaw",
  "context": {
    "candidateName": "李明",
    "position": "Senior Engineer",
    "interviewTime": "2026-03-10T14:00:00+08:00"
  },
  "skillId": "skill_interview_confirm"
}
// → Returns: { taskId, callUrl, roomName }
```

### Reporting progress

**You MUST report every step** so the user can see real-time progress in Relay Console:

```json
// Step 1: Planning
// MCP call: report_step
{ "taskId": "task_xxx", "step": "planning", "description": "Checking calendar availability for 李明" }

// Step 2: Tool used
// MCP call: report_tool_used
{
  "taskId": "task_xxx",
  "toolName": "google_calendar.list_events",
  "channel": "google_calendar",
  "input": { "date": "2026-03-10" },
  "output": { "available": true },
  "success": true,
  "durationMs": 320
}

// Step 3: Making the call
// MCP call: report_step
{ "taskId": "task_xxx", "step": "calling", "description": "Initiating voice call with 李明" }

// Step 4: Conversation messages
// MCP call: report_message
{ "taskId": "task_xxx", "role": "agent", "content": "你好李明，我是Relay助手...", "channel": "voice" }
{ "taskId": "task_xxx", "role": "user", "content": "好的，周二下午两点没问题", "channel": "voice" }

// Step 5: Post-call action
// MCP call: report_tool_used
{
  "taskId": "task_xxx",
  "toolName": "google_calendar.create_event",
  "channel": "google_calendar",
  "input": { "title": "面试 - 李明", "time": "2026-03-10T14:00:00+08:00" },
  "output": { "eventId": "evt_xxx" },
  "success": true
}

// Step 6: Complete
// MCP call: complete_task
{
  "taskId": "task_xxx",
  "status": "completed",
  "summary": "已确认面试时间：3月10日14:00，已创建日历事件",
  "result": {
    "confirmed": true,
    "interviewTime": "2026-03-10T14:00:00+08:00",
    "calendarEventId": "evt_xxx"
  },
  "analysisResult": {
    "outcome": "confirmed",
    "sentiment": "positive",
    "keyPoints": ["候选人确认时间", "已同步日历"]
  }
}
```

---

## 4. Keeping Connection Alive

### Heartbeat (every 60 seconds)

```json
// MCP call: integration_heartbeat
{ "organizationId": "org_xxx", "integrationId": "int_xxx" }
```

If no heartbeat for 2 minutes, Relay marks the integration as **disconnected**.

### Syncing tool changes

When you gain or lose access to tools:

```json
// MCP call: sync_tools
{
  "organizationId": "org_xxx",
  "integrationId": "int_xxx",
  "tools": [ /* full updated list */ ]
}
```

---

## 5. Reading User Context

Before executing a task, check what you know about the user:

```json
// MCP call: get_user_context
{ "userId": "user_xxx", "organizationId": "org_xxx" }
// → Returns: { timezone, workingHours, preferredLang, commStyle, profile, memory }
```

Use this to:
- Respect working hours (don't call at midnight)
- Use preferred language
- Match communication style
- Address the user by their preferred name

---

## 6. Available MCP Tools Summary

### Task Management
| Tool | Description |
|------|------------|
| `create_task` | Create a new task, get call URL |
| `get_task` | Get task details |
| `list_tasks` | List tasks by org/status |
| `cancel_task` | Cancel a pending task |

### Progress Reporting
| Tool | Description |
|------|------------|
| `report_step` | Report execution step (planning, calling, etc.) |
| `report_tool_used` | Report a tool invocation with input/output |
| `report_message` | Report a conversation message |
| `complete_task` | Mark task as done with summary |

### Integrations
| Tool | Description |
|------|------------|
| `register_integration` | Register agent + its tools |
| `sync_tools` | Push updated tool list |
| `integration_heartbeat` | Keep-alive signal |
| `list_integrations` | See all connected integrations |

### User Context
| Tool | Description |
|------|------------|
| `get_user_context` | Read user preferences + memory |
| `update_user_memory` | Push learned preferences |

### Voice
| Tool | Description |
|------|------------|
| `create_voice_call` | Create a voice call with skill |

### Skills
| Tool | Description |
|------|------------|
| `list_skills` | List available skill templates |
| `get_skill` | Get skill details + prompt |

---

## 7. Trial & Billing

Relay bills by **voice minutes**, not by call count:

| Plan | Monthly quota |
|------|--------------|
| Free | 20 minutes |
| Pro  | 300 minutes |
| Team | 1200 minutes |

Extra minutes can also be purchased as credits (`minutesBalance`). A call is allowed if either monthly quota OR credit balance remains.

- When `relay_create_call` returns a message containing `"No voice minutes remaining"`, tell the user:
  - Their monthly quota and credits are both exhausted
  - Provide the upgrade URL from the message
  - Do **not** retry the call — wait for user to upgrade or top up

Example agent response when quota is exhausted:
```
Your Relay voice minutes for this month have been used up.
Upgrade your plan or buy more minutes here: https://your-relay.app/settings/billing
```

---

## 8. Best Practices

1. **Always report steps** — Users trust what they can see. Report every step.
2. **Fail gracefully** — If a tool fails, report it, then try alternatives.
3. **Respect context** — Read user context before every task.
4. **Update memory** — After learning something new, push to memory.
5. **Heartbeat** — Keep the heartbeat running so users see you as "online".
6. **Summarize well** — The `complete_task` summary is what users read first.
7. **Tell user before waiting** — Always say "I'm waiting for the call to finish…" before calling `relay_get_result`.
8. **Store taskId** — After `relay_create_call`, remember the taskId for `relay_get_result`.

---

*Relay MCP Server: `relay-mcp` v0.1.0*
*Documentation last updated: 2026-03-11*
