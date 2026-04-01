# OpenClaw 接入指南

## 什么是 OpenClaw

OpenClaw 是一个开源的本地 AI Agent 运行时，拥有 3,200+ MCP Skills（日历、Slack、GitHub、Notion 等）。当 Flowmail 作为 MCP Server 接入 OpenClaw 后，你的本地 Agent 可以跨系统协同——例如从邮件中识别会议需求后自动创建日历事件。

## 前置条件

- 已部署/运行 Flowmail 实例
- 已注册并创建了 Organization

## 第一步：安装 OpenClaw

三种方式任选：

```bash
# 方式 A：一键安装（推荐）
curl -fsSL https://openclaw.ai/install.sh | bash

# 方式 B：npm 全局安装
npm install -g openclaw@latest

# 方式 C：pnpm
pnpm add -g openclaw@latest
```

安装后初始化：

```bash
openclaw onboard --install-daemon
openclaw --version  # 验证
```

## 第二步：获取 Flowmail API Token

1. 登录 Flowmail Web 界面
2. 进入 **设置** → **Agent / MCP 接入**
3. 点击「创建 Token」
4. 输入名称（如 "OpenClaw Production"）
5. 点击「创建」后 **立即复制** 生成的 Token（仅显示一次）

Token 格式：`fm_` + 64 位随机字符，例如 `fm_a1b2c3d4e5f6...`

## 第三步：配置 openclaw.json

编辑你的 OpenClaw 配置文件，添加 Flowmail MCP Server：

```json
{
  "mcp": {
    "servers": {
      "flowmail": {
        "url": "https://your-flowmail-domain.com/mcp/streamable-http",
        "headers": {
          "Authorization": "Bearer fm_your_token_here"
        }
      }
    }
  }
}
```

重启生效：

```bash
openclaw gateway restart
```

## 第四步：验证连接

```bash
# 查看已加载的 MCP 服务
openclaw mcp list

# 测试调用
openclaw agent --message "列出我的待审批事项"
```

如果输出了审批列表，说明接入成功。

## 配置其他 MCP 客户端

### Cursor

在项目根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "flowmail": {
      "url": "https://your-flowmail-domain.com/mcp/streamable-http",
      "headers": {
        "Authorization": "Bearer fm_your_token_here"
      }
    }
  }
}
```

### Claude Desktop

在 Claude Desktop 设置中添加 MCP Server，填入同样的 URL 和 Authorization header。

## 可用能力

通过 MCP 接入后，Agent 可以调用以下 Flowmail 工具：

| 工具 | 用途 |
|------|------|
| `list_entities` | 列出事项（审批/汇报/问题/反馈） |
| `get_entity` | 获取事项详情（含时间线和关联邮件） |
| `update_entity_status` | 更新事项状态 |
| `list_pending_approvals` | 列出待审批事项 |
| `approve_request` | 批准审批 |
| `reject_request` | 拒绝审批 |
| `list_reports` | 列出汇报 |
| `get_report_summary` | 获取 AI 汇报摘要 |
| `list_email_connections` | 列出邮箱连接 |
| `search_emails` | 搜索邮件 |
| `get_entity_timeline` | 获取事项时间线 |
| `add_timeline_event` | 添加时间线事件 |
| `get_timeline_diff` | AI 语义对比 |
| `predict_entity_risk` | AI 风险预测 |

## 与 OpenClaw 生态联动

接入 Flowmail 后，OpenClaw Agent 可以组合使用其他 Skills 实现跨系统自动化：

| 场景 | Flowmail 工具 | 联动 Skill |
|------|--------------|-----------|
| 邮件审批后通知 Slack | `approve_request` | slack |
| 汇报中提到的会议自动创建 | `get_report_summary` | google-calendar |
| 风险项自动创建 GitHub Issue | `predict_entity_risk` | github |
| 审批结果同步到 Notion | `approve_request` | notion |

## Flowmail 侧边栏 Agent vs MCP 接入

| 维度 | 侧边栏 Agent | OpenClaw / MCP 接入 |
|------|-------------|-------------------|
| 配置成本 | 零配置，内置 | 需创建 Token + 配置 |
| 交互体验 | 富 UI 卡片，流式输出 | 纯文本，由 Agent 控制 |
| 能力范围 | 仅 Flowmail | Flowmail + 3,200+ 外部系统 |
| 运行环境 | 云端托管 | 本地或云端，用户自控 |
| 适合场景 | 快速查看和操作 | 复杂跨系统自动化流程 |

## 常见问题

### Token 丢失怎么办？

Token 仅在创建时显示一次。如果丢失，请在设置页面停用旧 Token 并创建新的。

### 连接失败？

1. 确认 Flowmail 实例可以从网络访问（本地开发请用 `localhost` 或 ngrok）
2. 确认 Token 未被停用或过期
3. 检查 URL 路径是否包含 `/mcp/streamable-http`

### organizationId 在哪里？

不需要了。API Token 已绑定 Organization，所有 MCP 工具自动使用 Token 对应的组织。
