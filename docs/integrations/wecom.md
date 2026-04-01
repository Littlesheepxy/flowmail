# 企业微信（WeCom / 微信企业版）

> **一公司一文档**：企微相关能力只在本页维护。

## 元数据

- **代码标识**：`wecom`（`EmailConnection.provider`）
- **参考 CLI 仓库**：[WecomTeam/wecom-cli](https://github.com/WecomTeam/wecom-cli)（终端与 Agent；以仓库说明为准）
- **开放平台**：[企业微信开发者中心](https://developer.work.weixin.qq.com/)
- **Flowmail 实现入口**：
  - `packages/api/modules/email-connections/procedures/connect-oauth.ts` — `PROVIDER_CONFIG.wecom`（注意：当前为 `gettoken` 形态，与标准用户 OAuth 流可能不一致，接入前需对照官方文档复核）
  - `packages/api/modules/email-connections/procedures/connect-imap.ts` — 腾讯企业邮 IMAP 预设
  - `apps/web/modules/flowmail/components/EmailConnectionsList.tsx` — 连接 UI

## 鉴权

- **模式**：以代码为准逐步对齐官方「企业应用 / 用户授权」文档
- **Token 刷新**：**尚未**实现自动 refresh
- **用户配置**：邮箱连接页

## 已接入能力

| 能力 | 说明 | 代码位置 |
|------|------|----------|
| 连接与 token | 见 `connect-oauth` 中 wecom 分支 | `connect-oauth.ts` |
| 企业邮 IMAP 预设 | `imap.exmail.qq.com` | `connect-imap.ts` |

## 规划中 / 对照官方 Skills

| 官方 / CLI | 说明 | Flowmail |
|------------|------|----------|
| wecom-cli Skills | 本地 Agent | 仅参考 |
| 企微邮箱 / 应用消息 API | 与 MVP 邮箱主线对齐时单独立项 | 规划中 |

## CLI 鉴权模式对照

> 2026-04 调研结论，基于 `WecomTeam/wecom-cli` README。

| 项目 | 说明 |
|------|------|
| **CLI 是否内置 App ID** | **否** — 需提供机器人 Bot ID + Secret，`wecom-cli init` 交互配置，加密存 `~/.config/wecom/bot.enc` |
| **OAuth 流程** | **非标准用户 OAuth** — CLI 以机器人凭证（Bot ID + Secret）调用开放平台能力，不是浏览器跳转授权流 |
| **对 Flowmail 的影响** | 企微与飞书类似，需用户提供自建应用凭证。当前 `connect-oauth.ts` 中的 `gettoken` 走的是「企业应用凭证」模式，而非标准用户 OAuth；接入前需对照官方文档复核实际可用流程 |
| **待验证** | 当前 `PROVIDER_CONFIG.wecom` 使用 `gettoken`（corpid + corpsecret），此为企业级令牌而非用户级。是否需要改为「网页授权登录」或「自建应用代开发」模式？ |

## 风险与合规

- 通讯录、会话类能力敏感；未接前勿在 MCP 中暴露半成品接口
