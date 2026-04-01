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

## CLI 鉴权模式对照

> 2026-04 调研结论，基于 `DingTalk-Real-AI/dingtalk-workspace-cli`（命令 `dws`）README。

| 项目 | 说明 |
|------|------|
| **CLI 是否内置 App ID** | **是（默认模式）** — `dws auth login` 直接走浏览器/Device Flow 登录，用户选组织授权即可，不需要提供 Client ID |
| **自建应用模式** | 可选 `--client-id` / `--client-secret` 参数，面向 CI/CD 和 ISV 场景。需在开放平台配置重定向 URL |
| **OAuth 流程** | Device Flow（`dws auth login --device`）或浏览器 OAuth |
| **对 Flowmail 的影响** | 钉钉的默认模式暗示**平台侧内置了统一 Client**。Flowmail 作为第三方 SaaS 是否可以复用此模式（ISV 接入），需进一步确认钉钉开放平台的 ISV 策略。若可行，用户体验可比飞书更轻（无需填 App ID/Secret） |
| **ISV 模式结论** | **可行但需上架**：钉钉支持 ISV 第三方企业应用，Flowmail 可在钉钉应用市场上架后，企业用户直接安装授权，无需填 Client ID/Secret。需入驻成为钉钉服务商 → 创建第三方应用 → 通过审核上架。使用 `suite_access_token` + 企业授权 `corp_access_token` 模式。**当前 MVP 阶段优先级低，先保持用户自建应用模式** |

## 风险与合规

- 企业数据与钉钉租户绑定；多租户以 `organizationId` + 连接表隔离
