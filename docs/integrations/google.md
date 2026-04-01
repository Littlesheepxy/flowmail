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

## 风险与合规

- Google Cloud 项目 OAuth 审核、scope 最小化；Workspace 管理员策略可能限制第三方应用
