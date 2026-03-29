# Relay

AI-powered voice communication platform. Every capability is exposed as both REST API and MCP Tools — AI Agent friendly by design.

## Architecture

```
relay/
├── apps/web/           # Next.js SaaS application (auth, billing, dashboard)
├── packages/           # Shared TypeScript packages (api, auth, db, payments, mcp)
├── services/           # Python microservices
│   ├── voice-agent/    # Pipecat voice AI pipeline
│   ├── voice-api/      # FastAPI for voice/task management
│   ├── mcp_server/     # MCP server (Python, legacy — migrating to packages/mcp)
│   └── livekit/        # LiveKit WebRTC config
├── tooling/            # Build tooling and shared configs
└── docker-compose.yml  # Infrastructure: PG + Redis + MinIO + LiveKit + Python services
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- Docker & Docker Compose
- Python 3.11+ (for voice services)

### Development

```bash
# 1. Start infrastructure + Python services
docker compose up -d

# 2. Install Node.js dependencies
pnpm install

# 3. Initialize database
pnpm --filter database db:push

# 4. Start Next.js dev server
pnpm dev
```

## Dual Interface: API + MCP

Every platform capability has two entry points:

- **REST API** — for web frontend and traditional integrations
- **MCP Tools** — for AI agents (OpenClaw, Claude, Cursor, etc.)

Both share the same business logic packages — MCP is not a wrapper around the API.
