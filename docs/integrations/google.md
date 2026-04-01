# Google（Gmail / Workspace）

> **一公司一文档**：Google 侧邮箱相关集成统一在本页；与飞书/钉钉/企微文档并列，互不合并。

## 元数据

- **代码标识**：`gmail`（当前 Flowmail 邮箱连接；Workspace 与 consumer Gmail 共用 Google OAuth 应用时可先记在同一页）
- **参考 CLI / 工具**：[googleworkspace/cli](https://github.com/googleworkspace/cli)（`gws`，README 注明非 Google 商业支持产品，可作 API/鉴权参考）
- **官方文档**：[Gmail API](https://developers.google.com/gmail/api)、[Google Workspace](https://developers.google.com/workspace)
- **Flowmail 实现入口**：
  - `packages/api/modules/email-connections/procedures/connect-gmail.ts` — OAuth 连接
  - `packages/email-processor/src/connectors/gmail.ts` — 拉信
  - `packages/api/modules/email-connections/procedures/send-email.ts` — Gmail 发信分支
  - 环境变量：`GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`（`.env.example`）

## 鉴权

- **模式**：OAuth 2.0（`connect-gmail` + Google OAuth 客户端）
- **Token 刷新**：通过 `googleapis` OAuth2 客户端在调用链上刷新（与飞书手写 refresh 路径不同）
- **用户配置**：Gmail 连接走平台级 Client ID/Secret + 用户授权（具体以当前实现为准）

## 已接入能力

| 能力 | 说明 | 代码位置 |
|------|------|----------|
| 收件同步 | Gmail API | `gmail.ts`、`sync.ts` |
| 发信 | Gmail API `send` | `send-email.ts` |
| 附件 | Gmail attachments | `download-attachment.ts` |

## 规划中 / 对照官方 Skills

| 参考 | 说明 | Flowmail |
|------|------|----------|
| gws / Workspace CLI Skills | 日历、Drive、Chat 等 | MVP 以邮件为主；扩展时单列子章节或新开「能力子页」仍归属 Google 公司文档 |
| Domain-wide delegation | 企业域管理员场景 | 未接 |

## CLI 鉴权模式对照

> 2026-04 调研结论，基于 `gcloud` CLI 官方文档。

| 项目 | 说明 |
|------|------|
| **CLI 是否内置 App ID** | **是** — `gcloud auth login` 使用 Google 为 Cloud SDK 内置的 OAuth Client ID，用户只需登录 Google 账号 |
| **OAuth 流程** | 浏览器 OAuth 2.0（默认）；无浏览器可用 `--no-browser` / `--no-launch-browser` 复制 URL 方式 |
| **自有 Client 可选** | `gcloud auth application-default login --client-id-file=...` 支持使用自有 OAuth Client |
| **对 Flowmail 的影响** | **体验最好的厂商**。Flowmail 可使用自有 Google Cloud 项目的 OAuth Client ID（`GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`），用户在连接页点击「登录 Google」即可完成授权，无需填任何凭证 |
| **当前状态** | Gmail OAuth 连接框架已在 `connect-gmail.ts` 中实现。需确保 Google Cloud 控制台的 OAuth consent screen 已配置好 scope（`gmail.readonly`, `gmail.send` 等）并通过审核 |

## 风险与合规

- Google Cloud 项目 OAuth 审核、scope 最小化；Workspace 管理员策略可能限制第三方应用
