# 飞书（Lark）

> **一公司一文档**：飞书仅在本页记录；钉钉 / 企微 / Google 见同目录其它文件。

## 元数据

- **代码标识**：`feishu`（`EmailConnection.provider`、connector key）
- **参考 CLI 仓库**：[larksuite/cli](https://github.com/larksuite/cli) — 官方 Lark CLI，含多域 Skills、OpenAPI 命令、`lark-cli api` 直通接口；**本地 Agent 可直接装 Skills，与 Flowmail MCP 互补**
- **开放平台**：[飞书开放平台](https://open.feishu.cn/) — 邮件能力见邮箱相关 OpenAPI
- **Flowmail 实现入口**：
  - `packages/email-processor/src/connectors/feishu.ts` — 拉取邮件
  - `packages/api/modules/email-connections/lib/feishu-oauth-token.ts` — OAuth user token 刷新
  - `packages/api/modules/email-connections/procedures/connect-oauth.ts` — 授权码换 token
  - `packages/api/modules/email-connections/procedures/send-email.ts` / `download-attachment.ts` / `sync.ts` — 发信、附件、同步前刷新
  - `apps/web/modules/flowmail/components/EmailConnectionsList.tsx` — 连接与 OAuth 引导

## 鉴权

- **模式**：企业自建应用 **用户 OAuth**（`authen/v2/oauth/token`），连接维度存储 `appId` / `appSecret` / `refreshToken`
- **Token 刷新**：`grant_type=refresh_token`，过期前约 5 分钟自动刷新（见 `ensureFeishuOAuthAccessToken`）
- **用户配置**：组织内「邮箱连接」页填写 App ID、Secret 并完成浏览器授权（非根目录 `.env`）

## 已接入能力

| 能力 | API / 参考 | 代码位置 |
|------|------------|----------|
| 收件箱列表与拉信 | `mail/v1/user_mailboxes/.../messages` | `feishu.ts` |
| 发信 | `mail/v1/.../messages` POST | `send-email.ts` |
| 附件下载 URL + token | `attachment_download` | `download-attachment.ts` |

## 规划中 / 对照官方 Skills（逐条补全）

> 下列 **lark-*** Skills 来自 [larksuite/cli 文档](https://github.com/larksuite/cli)；Flowmail **MVP 以邮箱为主线**，非邮件能力默认「仅参考 / 本地 CLI」，避免范围膨胀。

| 官方 Skill / 域 | 说明 | Flowmail |
|-----------------|------|----------|
| lark-mail | 邮箱 | **已部分接入**（API 直连，非 CLI） |
| lark-im / lark-calendar / lark-doc / … | IM、日历、文档等 | **未接**；可后续通过 MCP 扩展独立 tools，须先写 `packages/` 再双轨暴露 |
| lark-shared | 登录与配置 | **不适用云端**；用户本地 OpenClaw + 官方 Skill |

## 风险与合规

- 租户数据隔离依赖 **organizationId + EmailConnection**；token 存 DB，需配合现有安全与审计策略
- 官方 CLI README 中的 **Agent 安全提示**（群聊、权限滥用）应在产品说明中向用户引用或简述
