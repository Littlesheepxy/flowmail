# Subagent 架构设计

> 状态：**规划中**（2026-04）。当前 MVP 阶段侧边栏 Agent 直接注册 tool；当厂商能力扩展到邮箱之外时启用 subagent 架构。

## 背景与动机

侧边栏 Agent（`/api/agent/chat`）当前在单个 `streamText` 调用中注册了所有 tool。随着厂商能力扩展（日历、IM、文档等），问题会出现：

1. **System Prompt 膨胀**：tool 描述占大量 token，每轮对话都要重复发送
2. **上下文污染**：用户问飞书邮件时，钉钉/企微/Google 的 tool 也在上下文中
3. **Token 浪费**：执行一个简单操作需要携带完整上下文

## 目标架构

```
用户消息
  ↓
主 Agent（chat/route.ts）
  ├── 判断意图 → 直接回答（无需 tool）
  ├── 判断意图 → 调用本地 tool（get_entity 等当前已有的）
  └── 判断意图 → 分发到 subagent
        ↓
    Subagent 调度器
        ├── feishu_subagent（飞书专属 tool 集：邮件/日历/IM/文档）
        ├── dingtalk_subagent（钉钉专属 tool 集）
        ├── google_subagent（Gmail/Calendar/Drive）
        └── wecom_subagent（企微专属 tool 集）
        ↓
    返回结构化结果摘要
        ↓
主 Agent 用中文总结并展示卡片
```

## 实现方案

### Subagent = 独立的 `generateText` / `streamText` 调用

不是独立进程或服务，而是在主 Agent 的 tool `execute` 函数内发起一次新的 AI 调用：

```typescript
// 主 Agent 的 tool 定义
execute_vendor_task: tool({
  description: "将任务分发给厂商专属 subagent 执行",
  inputSchema: z.object({
    vendor: z.enum(["feishu", "dingtalk", "google", "wecom"]),
    task: z.string().describe("任务描述"),
    connectionId: z.string().describe("目标邮箱连接 ID"),
  }),
  execute: async ({ vendor, task, connectionId }) => {
    const vendorTools = getVendorTools(vendor, connectionId);
    const vendorPrompt = getVendorSystemPrompt(vendor);

    const result = await generateText({
      model: textModel,
      system: vendorPrompt,
      prompt: task,
      tools: vendorTools,
      maxSteps: 3,
    });

    return {
      vendor,
      task,
      result: result.text,
      toolsUsed: result.toolCalls?.map(tc => tc.toolName) ?? [],
    };
  },
})
```

### 厂商 Tool 集注册

每个厂商的 tool 集放在独立模块中：

```
packages/api/modules/vendor-tools/
├── feishu/
│   ├── mail-tools.ts      # 邮件相关
│   ├── calendar-tools.ts  # 日历（未来）
│   └── index.ts           # 导出所有 feishu tools
├── google/
│   ├── gmail-tools.ts
│   ├── calendar-tools.ts
│   └── index.ts
├── dingtalk/
│   └── ...
├── wecom/
│   └── ...
└── registry.ts            # getVendorTools() 路由函数
```

### 何时启用

触发条件（满足任一即考虑迁移）：

- 单个厂商的 tool 数量超过 5 个
- 主 Agent 的 tool 总数超过 15 个
- 多厂商同类能力重复（如飞书/钉钉/Google 都有日历 tool）

### 不在 MVP 实现的原因

1. 当前只有邮箱场景，4 个新增操作类 tool 不构成膨胀问题
2. Subagent 引入额外 AI 调用，增加延迟和成本
3. 需要先验证各厂商 API 的实际集成效果，才能合理划分 subagent 边界

## 与 OpenClaw 的关系

- **云端 Flowmail Agent**：使用上述 subagent 架构，tool 的 `execute` 函数调用 HTTP API
- **本地 OpenClaw Agent**：通过 Flowmail MCP（`/mcp/[transport]`）获取 Flowmail 能力，同时可安装各厂商官方 CLI Skills 直接操作本地环境
- **两者互补**：云端 Agent 覆盖需要持久化/多租户的场景，本地 Agent 覆盖需要本地文件系统/CLI 的场景

## Token 优化策略

| 策略 | 说明 |
|------|------|
| Subagent 使用精简 system prompt | 只包含该厂商的能力描述和 API 约定 |
| 只传递必要上下文 | 主 Agent 从页面上下文中提取与任务相关的部分 |
| 结果摘要而非原始返回 | Subagent 返回结构化摘要，主 Agent 不需要看 API 原始响应 |
| 使用更小模型执行 | 简单 CRUD 操作可用 gpt-4o-mini 或同级别模型 |
