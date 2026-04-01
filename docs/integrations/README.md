# 第三方集成（厂商隔离与 CLI / Skills 借鉴）

## 一公司一文档（查看方式）

- **每个厂商单独一个 Markdown 文件**，文件名用小写英文标识（如 `feishu.md`、`dingtalk.md`），**禁止**把多个公司的能力混在同一文档里，方便按 Ctrl+P / 目录树直接打开。
- **本页（README）只做索引与规范**；具体端点、鉴权、代码路径一律写在对应厂商文档里。

目标：把「官方 CLI / Skills 仓库」与「Flowmail 内实现」边界划清，方便后续逐个收割能力，而不把参考实现混进业务代码。

## 分层（必须遵守）

| 层 | 内容 | 说明 |
|----|------|------|
| **参考层（不入库实现）** | 各厂商 GitHub CLI、`SKILL.md`、OpenAPI 文档 | 只在本目录文档中 **链接 + 摘要**；不在 `packages/` 里复制其代码 |
| **契约层** | 本目录 `*.md` + 必要时 `packages/api/.../types` 里与厂商无关的通用类型 | 每个厂商一页：**鉴权模型、已接 API、待接清单、Skills → 我方 MCP/oRPC 映射** |
| **实现层** | `packages/email-processor/connectors`、`packages/api/modules/email-connections`、MCP tools | **唯一真相**；禁止在 MCP tool 内堆厂商特有逻辑而不复用 connector / procedure |

云端 Agent **不执行**厂商 CLI 二进制；CLI/Skills 作为 **参数范例与覆盖面对照表**。本地用户可通过 OpenClaw 安装官方 Skills，与 Flowmail MCP **并列**，由用户环境承担 CLI。

## 新增一个厂商时的顺序（「一个文档一个文档」）

1. 在 `docs/integrations/` 下新增 `{vendor}.md`，按下方模板写满 **第一节**（元数据 + 参考链接）即可合并，能力清单可以逐次补全。
2. 若开始写代码：connector / OAuth / refresh 放在 **独立文件**（例如已有 `feishu-oauth-token.ts` 模式），命名带厂商前缀，避免 `oauth-misc.ts`。
3. 暴露给 Agent 的能力：**先**在 `packages/` 实现函数，**再**同时挂 oRPC + MCP（双轨）。
4. 每借鉴一个官方 Skill：在对应 `{vendor}.md` 里增加一行映射表（Skill 名 → Flowmail 状态：已实现 / 规划中 / 仅本地 CLI）。

## 文档模板（复制到新文件）

```markdown
# {厂商显示名}

## 元数据
- **代码标识**（provider 字符串）：
- **参考 CLI 仓库**：
- **开放平台文档**：
- **Flowmail 实现入口**（路径列表）：

## 鉴权
- 模式（OAuth / 应用令牌 / 等）：
- Token 刷新：
- 用户侧配置位置（UI / 环境变量）：

## 已接入能力
| 能力 | API / 命令参考 | 代码位置 |
|------|----------------|----------|

## 规划中 / 对照官方 Skills
| 官方 Skill 或 CLI 领域 | 说明 | Flowmail |
|------------------------|------|----------|

## 风险与合规
- 数据出境 / 租户隔离 / 最小权限：
```

## 厂商文档索引（一厂一页）

| 文档 | 公司 / 产品 |
|------|-------------|
| [feishu.md](./feishu.md) | 飞书（Lark） |
| [dingtalk.md](./dingtalk.md) | 钉钉 |
| [wecom.md](./wecom.md) | 企业微信 |
| [google.md](./google.md) | Google（Gmail / Workspace 相关） |

新增其它厂商（如 Microsoft 365 / Outlook）时：**新建** `microsoft.md`（或 `outlook.md`），并在此表加一行。
