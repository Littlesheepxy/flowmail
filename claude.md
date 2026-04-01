# Flowmail — AI 原生业务执行平台

## 项目简介

Flowmail 是一个以邮箱为入口的 AI 原生业务执行平台。
**核心主张**：把邮件变成可以被 AI 执行的工作流。

基于 [supastarter-template](https://supastarter.dev) 构建，monorepo 结构（Turborepo + pnpm）。

## 快速上手

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## 重要文档

- `docs/integrations/README.md` — 第三方厂商隔离、CLI/Skills 借鉴流程与文档模板
- `docs/architecture/subagent-design.md` — Subagent 架构设计（厂商能力扩展方案）
- `.cursor/rules/product.mdc` — 产品定义、MVP 范围、业务边界
- `.cursor/rules/tech-stack.mdc` — 技术栈规范与架构决策（含双轨 API 设计）
- `.cursor/rules/mcp-tools.mdc` — MCP Tool 完整清单与实现规范（Agent 调用层）
- `.cursor/rules/ai-email.mdc` — AI 邮件处理 Prompt 与 Schema 规范
- `agents.md` — supastarter 代码规范（必读）

## 核心包结构

```
apps/web/              # Next.js 16 主应用
packages/
├── api/               # oRPC API 层
├── auth/              # better-auth 认证
├── database/          # Prisma + PostgreSQL
├── ai/                # Vercel AI SDK 集成
├── mail/              # React Email + Resend
├── email-processor/   # 【Flowmail 新增】邮件解析与 AI 处理
└── ui/                # shadcn/ui 组件库
```

## MVP 场景（当前阶段）

1. **审批（Approval）**：邮件 → AI 识别审批请求 → 结构化事项 → 审批操作
2. **汇报跟踪（Report Tracking）**：邮件 → AI 提取进展 → timeline 追踪

**不在范围内**：完整邮件客户端、全自动执行、超过 2 个场景。

## Agent 接入架构（三层）

```
任何 Agent（Claude / Cursor / OpenClaw / 自建）
        ↓              ↓              ↓
   MCP URL        .mcp.json      OpenClaw Skill
  （云端）       （本地配置）    skills/flowmail/SKILL.md
        └──────────────┴──────────────┘
                       ↓
           /mcp/[transport]/route.ts
                       ↓
          packages/（核心业务逻辑）
```

**OpenClaw**：最主流开源本地 Agent 运行时，已有 3,200+ Skills（日历/Slack/GitHub 等），
Flowmail 提供 Skill 文件后，用户的本地 Agent 可跨系统自动协同。

## 技术决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 前端 API 层 | oRPC | 类型安全，模板已集成 |
| Agent API 层 | MCP Server（mcp-handler） | 2026 Agent 调用行业标准，支持 Claude/GPT/Cursor |
| AI SDK | Vercel AI SDK v5 | 模型无关，streaming 支持 |
| 邮件接入 | Gmail OAuth（MVP） | 最大用户群，API 成熟 |
| 任务队列 | trigger.dev | 适合邮件异步处理场景 |
| 代码质量 | Biome | 模板已配置，统一风格 |
