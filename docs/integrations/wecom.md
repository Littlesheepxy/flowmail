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

## 风险与合规

- 通讯录、会话类能力敏感；未接前勿在 MCP 中暴露半成品接口
