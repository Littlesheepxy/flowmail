# 钉钉（DingTalk）

> **一公司一文档**：钉钉相关能力只在本页维护，不写到飞书/企微页。

## 元数据

- **代码标识**：`dingtalk`（`EmailConnection.provider`）
- **参考 CLI 仓库**：[DingTalk-Real-AI/dingtalk-workspace-cli](https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli)（官方开源 Workspace CLI，含 Agent Skills）
- **开放平台**：[钉钉开放平台](https://open.dingtalk.com/)
- **Flowmail 实现入口**：
  - `packages/api/modules/email-connections/procedures/connect-oauth.ts` — `PROVIDER_CONFIG.dingtalk`（换 token、拉用户信息）
  - `packages/api/modules/email-connections/procedures/connect-imap.ts` — IMAP 默认 `imap.dingtalk.com`
  - `apps/web/modules/flowmail/components/EmailConnectionsList.tsx` — 连接 UI

## 鉴权

- **模式**：OAuth 用户访问令牌（与 `connect-oauth` 中 `api.dingtalk.com` 配置一致）
- **Token 刷新**：**尚未**实现与飞书同级的自动 refresh；需在本文档跟进后补 `lib/dingtalk-oauth-token.ts` 一类模块
- **用户配置**：邮箱连接页填写应用凭据并完成授权

## 已接入能力

| 能力 | 说明 | 代码位置 |
|------|------|----------|
| OAuth 连接换 token | 授权码 → access/refresh | `connect-oauth.ts` |
| IMAP 预设 | 主机/端口 | `connect-imap.ts`、`connect-oauth.ts` 内 `IMAP_DEFAULTS` |

## 规划中 / 对照官方 Skills

| 官方 / CLI 域 | 说明 | Flowmail |
|---------------|------|----------|
| 钉钉邮箱 API | 若与飞书对齐，需独立 connector + 发信/附件 | 规划中 |
| Workspace CLI Skills | 本地 Agent | 仅参考，不进云端 |

## 风险与合规

- 企业数据与钉钉租户绑定；多租户以 `organizationId` + 连接表隔离
