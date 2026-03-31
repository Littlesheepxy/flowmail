# Flowmail

AI-powered email execution platform. Flowmail turns your inbox into actionable workflows — approvals, reports, and tasks, handled automatically. Every capability is exposed as both REST API and MCP Tools — AI Agent friendly by design.

## Architecture

```
flowmail/
├── apps/web/              # Next.js SaaS application (auth, billing, dashboard, marketing)
├── packages/              # Shared TypeScript packages
│   ├── api/               # oRPC API routes (approvals, entities, email-connections)
│   ├── auth/              # Authentication (better-auth)
│   ├── database/          # Prisma ORM + PostgreSQL schema
│   ├── email-processor/   # AI email classification, extraction & summarization
│   ├── i18n/              # Internationalization (en/zh)
│   ├── mcp/               # MCP server (tools for agents)
│   ├── payments/          # Stripe billing
│   └── ui/                # Shared UI components
├── tooling/               # Build tooling and shared configs
└── docker-compose.yml     # Infrastructure: PostgreSQL + Redis + MinIO
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- Docker & Docker Compose

### Development

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Initialize database
pnpm --filter database db:push

# 4. Start Next.js dev server
pnpm dev
```

## Core Features

- **Smart Inbox** — AI classifies incoming emails into approvals, reports, issues, and more
- **One-click Approvals** — Review extracted details and approve/reject with full audit trail
- **Auto-execution** — Approved items trigger confirmation emails, calendar events, and IM notifications
- **Report Insights** — Extract progress, blockers, and next steps from status emails; auto-create tasks
- **Agent-native** — MCP tools covering the full lifecycle: classify, approve, execute, notify

## Dual Interface: API + MCP

Every platform capability has two entry points:

- **REST API** — for web frontend and traditional integrations
- **MCP Tools** — for AI agents (Claude, Cursor, OpenClaw, etc.)

Both share the same business logic packages — MCP is not a wrapper around the API.
