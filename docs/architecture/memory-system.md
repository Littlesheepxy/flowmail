# Flowmail Memory System — 架构设计文档

> 版本：v1.0 · 2026-04-15
>
> 定位：Flowmail 的记忆系统是 Agent 的"长期记忆层"，让 AI 越用越懂用户——
> 不只是记住对话历史，而是**从邮件交互中持续提炼结构化认知**。

---

## 一、核心理念

### 为什么需要记忆？

传统 AI 助手每次对话都从零开始。记忆系统解决的是：

```
第 1 封邮件：AI 不认识张伟，回复泛泛而谈
第 50 封邮件：AI 知道张伟是采购经理、说"收到"等于同意、
             预算超 5 万要附 ROI——回复精准到位
```

### 设计哲学：三层记忆模型

```
┌─────────────────────────────────────────────────┐
│  Layer 3：参照样本（Sample）                      │
│  "Hi 张伟，采购申请已审批通过，请按流程推进。"      │
│  → 具体的邮件原文，few-shot 级别的模仿依据         │
├─────────────────────────────────────────────────┤
│  Layer 2：模式规律（Pattern）                     │
│  "同意类：结论 + 行动指引，不超过 3 行"            │
│  → 场景化的行为模式，Chain-of-Thought 级别         │
├─────────────────────────────────────────────────┤
│  Layer 1：抽象总结（Summary）                     │
│  "语气专业但不生硬，段落简短，重点加粗"             │
│  → 高层风格描述，System Prompt 级别               │
└─────────────────────────────────────────────────┘
```

**类比 Prompt Engineering：**

| 记忆层 | 等价于 | 作用 |
|--------|--------|------|
| 抽象总结 | System Instruction | 定义"做什么样的人" |
| 模式规律 | Chain-of-Thought | 定义"不同场景怎么应对" |
| 参照样本 | Few-shot Examples | 定义"具体长什么样" |

只有抽象没有样本，模型对"专业但不生硬"的理解可能与用户不同。
三层结合后，模型才能**精确模仿**用户的真实写作风格。

---

## 二、数据架构

### 双表设计

```
┌───────────────────┐         ┌───────────────────┐
│   MemoryObject    │ 1 ──→ N │   AgentMemory     │
│  （结构化知识卡）   │         │  （叙事型日志）     │
├───────────────────┤         ├───────────────────┤
│ objectType        │         │ category          │
│ objectId          │         │ scope / scopeId   │
│ name              │         │ content (text)    │
│ attributes (JSON) │         │ metadata (JSON)   │
│ relations (JSON)  │         │ importance (1-10) │
│                   │         │ accessCount       │
│                   │         │ embedding (vec)   │
│                   │         │ memoryObjectId FK │
└───────────────────┘         └───────────────────┘
       唯一键:                        索引:
 (org, objectType, objectId)     (org, category)
                                 (org, scope, scopeId)
                                 (org, importance)
```

### MemoryObject — 结构化知识卡

每张卡是一个**实体的完整画像**，属性可自由扩展：

| objectType | 说明 | objectId | 典型属性 |
|-----------|------|----------|---------|
| `self` | 用户画像（单例） | userId / email | writing_style, sample_emails, reply_patterns, tone_preference, work_habits, signature |
| `person` | 联系人画像 | 邮箱地址 | role, company, communication_style, sample_interactions, sensitivity, relationship |
| `project` | 项目信息 | 项目 slug | status, deadline, owner, participants, progress, budget, key_context |
| `event` | 关键事件 | 事件标识 | happened_at, participants, impact, follow_up, related_project |
| `preference` | 业务规则 | 规则 slug | rule, context, scope, examples |
| `decision` | 决策记录 | 决策标识 | decision, reason, outcome, decided_at, related_entities |

**关键设计：`attributes` 是开放的 JSON 字段。** 类型的属性集合不是固定 schema，
而是由 AI 和用户自由扩展。UI 层通过 `fieldLabels` 映射做展示。

### AgentMemory — 叙事型日志

每条记录是一段**自由文本 + 元数据**，充当两种角色：

1. **独立记忆条目**：如分类学习记录、联系人简报、用户偏好
2. **MemoryObject 的变更日志**：通过 `memoryObjectId` FK 关联，记录属性变更历史

| category | 用途 |
|----------|------|
| `user_preference` | 用户偏好、写作风格分析结果 |
| `contact_profile` | 联系人画像片段 |
| `project_context` | 项目上下文 |
| `classification_learning` | 发件人→分类映射的学习记录 |
| `behavior_pattern` | 用户行为模式（确认/纠正反馈） |
| `decision_record` | 决策记录 |
| `object_update` | MemoryObject 属性变更审计日志 |
| `org_insight` | 组织级洞察 |

---

## 三、核心流程

### 3.1 记忆写入（从邮件到知识）

```
邮件进入
  │
  ├─→ processEmail (email-processor)
  │     │
  │     ├─→ classifyEmailWithMemory
  │     │     ├── recallBySender → 读历史分类记忆
  │     │     ├── LLM 分类
  │     │     └── recordClassification → 写回分类学习
  │     │
  │     └─→ recordContactProfile → 联系人简报
  │
  ├─→ Agent 聊天 (用户交互)
  │     │
  │     ├─→ upsert_memory_object → 结构化知识更新
  │     │     写 MemoryObject + 变更日志(AgentMemory)
  │     │
  │     ├─→ learn_reply_style → 风格学习
  │     │     读已发邮件 → LLM 分析 → 写 3 个属性：
  │     │     · writing_style（抽象总结）
  │     │     · sample_emails（参照样本）
  │     │     · reply_patterns（模式规律）
  │     │
  │     └─→ recordFeedback → 用户纠正/确认行为
  │
  └─→ 手动编辑 (MemoryManagerPanel UI)
        └─→ updateObjectAttribute → 单字段更新 + 审计日志
```

### 3.2 记忆召回（从知识到行动）

```
用户打开 Agent 聊天
  │
  ├─→ recallFocused (叙事记忆)
  │     ├── 联系人 scope → contact_profile, classification_learning
  │     ├── 项目 scope → project_context, decision_record
  │     └── 全局 → user_preference, behavior_pattern
  │
  ├─→ getSelf → self 对象完整属性
  ├─→ getObject("person", email) → 联系人对象
  │
  └─→ 注入 System Prompt
        │
        ├── 叙事记忆 → "记忆上下文" 段落
        └── 结构化对象 → "结构化记忆" 段落
              │
              ↓
        Agent 回复 / 调用工具
```

### 3.3 记忆在回复起草中的应用

```
draft_reply 被调用
  │
  ├─→ 读 self 对象（优先结构化）
  │     ├── writing_style → "风格总结：..."
  │     ├── sample_emails → "参照邮件：📧 审批回复..."
  │     ├── reply_patterns → "回复模式：同意类/拒绝类..."
  │     └── signature → "署名：Best regards, Yang"
  │
  ├─→ 读 person 对象（联系人画像）
  │     ├── role, company → 基本信息
  │     ├── communication_style → 沟通特点
  │     ├── sample_interactions → "典型对话：📨 张伟发来..."
  │     └── sensitivity → 敏感点
  │
  └─→ 拼入 Prompt
        "请严格模仿参照邮件中的用词、句式和语气..."
        "注意收件人的沟通习惯和敏感点..."
              │
              ↓
        LLM 生成回复草稿
```

---

## 四、系统架构图

```
                    ┌──────────────┐
                    │  Gmail/API   │
                    │  Webhooks    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ email-       │ recordClassification
                    │ processor    │ recordContactProfile
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │    MemoryManager        │
              │  (packages/agent)       │
              │                         │
              │  ┌──────────────────┐   │
              │  │ 写入 API         │   │
              │  │ · write          │   │
              │  │ · record*        │   │
              │  │ · upsertObject   │   │
              │  └──────────────────┘   │
              │                         │
              │  ┌──────────────────┐   │
              │  │ 召回 API         │   │
              │  │ · recall         │   │
              │  │ · recallFocused  │   │
              │  │ · getSelf        │   │
              │  │ · getObject      │   │
              │  └──────────────────┘   │
              │                         │
              │  ┌──────────────────┐   │
              │  │ 维护 API         │   │
              │  │ · applyDecay     │   │
              │  │ · deleteObject   │   │
              │  │ · updateAttr     │   │
              │  └──────────────────┘   │
              └────────┬───────┬────────┘
                       │       │
           ┌───────────▼┐  ┌──▼──────────┐
           │ Agent Chat  │  │  oRPC API   │
           │ /api/agent  │  │ /api/rpc    │
           │ /chat       │  │ /memory/*   │
           │             │  │             │
           │ · planner   │  │ · list      │
           │ · tools     │  │ · update    │
           │   - reply   │  │ · delete    │
           │   - memory  │  │ · objects   │
           └──────┬──────┘  └──────┬──────┘
                  │                │
           ┌──────▼────────────────▼──────┐
           │         PostgreSQL           │
           │  ┌──────────┐ ┌───────────┐  │
           │  │ memory_  │ │ agent_    │  │
           │  │ object   │ │ memory    │  │
           │  └──────────┘ └───────────┘  │
           └──────────────────────────────┘
                         ▲
                         │
           ┌─────────────┴─────────────┐
           │   MemoryManagerPanel      │
           │   (Web UI)                │
           │   · 查看/编辑结构化对象    │
           │   · 删除对象              │
           │   · 查看变更历史          │
           └───────────────────────────┘
```

---

## 五、代码模块地图

```
packages/agent/
├── memory/
│   └── manager.ts          # MemoryManager 核心类 (785 行)
├── core/
│   ├── types.ts            # 类型定义、常量 (218 行)
│   └── planner.ts          # System Prompt 构建 (328 行)
├── tools/
│   ├── memory-tools.ts     # upsert_memory_object 工具 (57 行)
│   └── reply-tools.ts      # draft_reply + learn_reply_style (354 行)
└── index.ts                # 导出

packages/api/modules/memory/
├── router.ts               # oRPC 路由聚合
├── types.ts                # Zod schemas
└── procedures/
    ├── list.ts             # 列出 AgentMemory
    ├── update.ts           # 更新条目
    ├── delete.ts           # 删除条目
    ├── get-contact-profile.ts
    ├── list-objects.ts     # 列出 MemoryObject
    ├── get-object.ts       # 获取对象 + 历史
    ├── update-object.ts    # 更新对象属性
    └── delete-object.ts    # 删除对象

packages/email-processor/src/
├── classifier.ts           # 记忆增强分类
└── processor.ts            # 收信处理（写入联系人记忆）

apps/web/
├── app/api/agent/chat/route.ts    # Agent 聊天入口（记忆注入）
└── modules/flowmail/components/
    ├── MemoryManagerPanel.tsx      # 记忆管理 UI (1209 行)
    └── ContactMemoryCard.tsx       # 联系人记忆卡片 (109 行)
```

---

## 六、已知局限与改进方向

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| 1 | `self` 主键不一致：learn_reply_style 用邮箱，upsertSelf 用 userId | 多用户时可能错对象 | 统一为 userId |
| 2 | chat/route.ts 中 `senderEmail` 恒为 undefined | 联系人记忆无法按当前邮件发件人加载 | 从 entity 的线程中提取 |
| 3 | `embedding` 字段未使用 | recall 只靠关键词 contains，语义搜索缺失 | 接入向量检索 |
| 4 | `applyDecay` 无调度 | 记忆只增不减 | 接入 cron job |
| 5 | 多个 `record*` 方法无调用点 | recordDecision/recordInsight 等预留能力未接入 | 在 Agent 工具中接入 |
| 6 | MCP 无记忆工具 | 外部 Agent 无法操作记忆 | 暴露到 MCP Server |
| 7 | 叙事型记忆无前端管理 | AgentMemory 行只能通过 API 管理 | 考虑是否需要 UI |

---

## 七、独立产品抽象方向：MemoryKit

### 7.1 产品定位

> **MemoryKit — 给任何 AI Agent 加上长期记忆的基础设施**
>
> 一句话：`npm install @memorykit/core` 后，你的 Agent 就有了
> 结构化记忆、参照样本学习、记忆衰减和知识图谱。

### 7.2 市场分析

目前 AI Agent 生态中，**记忆**是最被低估的基础设施：

| 现状 | 问题 |
|------|------|
| OpenAI Memory | 仅 ChatGPT 内置，不开放 API，不可自部署 |
| LangChain Memory | 仅 ConversationBuffer/Summary，无结构化对象 |
| Mem0 | 方向正确但侧重向量检索，缺少结构化知识卡 |
| Zep | 侧重对话历史压缩，非业务记忆 |

**Flowmail 记忆系统的差异化：**
- 不只是记"对话说了什么"，而是**提炼结构化业务知识**
- 三层记忆模型（抽象 + 模式 + 样本）是独创设计
- 变更审计日志天然支持知识溯源

### 7.3 产品架构

```
┌─────────────────────────────────────────────────┐
│  MemoryKit                                       │
│                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Core       │  │ Recall     │  │ Lifecycle  │  │
│  │            │  │            │  │            │  │
│  │ · Object   │  │ · Keyword  │  │ · Decay    │  │
│  │ · Memory   │  │ · Vector   │  │ · Merge    │  │
│  │ · Schema   │  │ · Hybrid   │  │ · Prune    │  │
│  │ · Audit    │  │ · Scoped   │  │ · Archive  │  │
│  └─────┬──────┘  └──────┬─────┘  └──────┬─────┘  │
│        └────────────┬───┘───────────────┘         │
│                     │                              │
│  ┌──────────────────▼───────────────────────────┐ │
│  │  Storage Adapters                             │ │
│  │  · PostgreSQL (Prisma)                        │ │
│  │  · SQLite (本地/Edge)                         │ │
│  │  · Supabase                                   │ │
│  │  · Turso (分布式 SQLite)                      │ │
│  │  · In-Memory (测试)                           │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │  Integrations                                 │ │
│  │  · AI SDK Plugin (Vercel)                     │ │
│  │  · LangChain Module                           │ │
│  │  · MCP Server                                 │ │
│  │  · REST API                                   │ │
│  │  · React Components (UI Kit)                  │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 7.4 核心 API 设计（草案）

```typescript
import { MemoryKit } from "@memorykit/core";
import { PostgresAdapter } from "@memorykit/adapter-postgres";

// 初始化
const memory = new MemoryKit({
  adapter: new PostgresAdapter({ connectionString: "..." }),
  embedding: { provider: "openai", model: "text-embedding-3-small" },
});

// ── 结构化对象 ──

// 创建/更新知识卡片（自动变更审计）
await memory.objects.upsert({
  type: "person",
  id: "zhang.wei@acme.com",
  name: "张伟",
  attributes: {
    role: "采购部经理",
    communication_style: "极度务实，邮件从不寒暄",
    sample_interactions: '📨 "采购申请：服务器 3 台..."',
  },
});

// 读取
const person = await memory.objects.get("person", "zhang.wei@acme.com");

// 列出某类型
const allContacts = await memory.objects.list({ type: "person" });

// 查看变更历史
const history = await memory.objects.history("person", "zhang.wei@acme.com");

// ── 叙事记忆 ──

// 写入
await memory.entries.write({
  category: "contact_profile",
  scope: { type: "contact", id: "zhang.wei@acme.com" },
  content: "张伟在4月8日的邮件中对交付延迟表示不满",
  importance: 7,
});

// 召回（关键词 + 向量混合）
const relevant = await memory.entries.recall({
  query: "张伟 采购 审批",
  scope: { type: "contact", id: "zhang.wei@acme.com" },
  limit: 10,
});

// ── 生命周期 ──

// 衰减（importance 随时间递减）
await memory.lifecycle.decay({ maxAge: "30d", threshold: 3 });

// 合并（同类型对象去重合并）
await memory.lifecycle.merge("person", "old-email@x.com", "new-email@x.com");

// 归档（低价值记忆移入冷存储）
await memory.lifecycle.archive({ importanceBelow: 2, olderThan: "90d" });

// ── AI SDK 集成 ──

import { withMemory } from "@memorykit/ai-sdk";

const result = await generateText(
  withMemory(model, memory, {
    userId: "user-123",
    contactEmail: "zhang.wei@acme.com",
  }),
  { prompt: "帮我回复张伟的邮件" }
);
```

### 7.5 与 Flowmail 的关系

```
Phase 1（当前）：记忆系统是 Flowmail 的内部模块
     packages/agent/memory/manager.ts

Phase 2（抽象）：提取为独立包，Flowmail 作为第一个消费者
     @memorykit/core          ← 通用记忆引擎
     @memorykit/adapter-*     ← 存储适配器
     @flowmail/memory         ← Flowmail 专属扩展（邮件分类学习等）

Phase 3（产品化）：独立发布，服务更多 Agent 生态
     memorykit.dev            ← 文档站
     SaaS Dashboard           ← 记忆管理 UI（基于 MemoryManagerPanel）
     MCP Server               ← 标准 Agent 接入
```

### 7.6 差异化价值

| 维度 | MemoryKit | Mem0 | LangChain Memory |
|------|-----------|------|------------------|
| 结构化对象 | 是（6+ 类型） | 否 | 否 |
| 参照样本学习 | 是（三层模型） | 否 | 否 |
| 变更审计 | 是（每次变更记录） | 否 | 否 |
| 向量检索 | 是（混合召回） | 是 | 部分 |
| 生命周期管理 | 是（衰减/合并/归档） | 部分 | 否 |
| 存储可插拔 | 是（Adapter 模式） | 部分 | 否 |
| AI SDK 原生集成 | 是 | 否 | 是（LangChain） |
| MCP 标准 | 是 | 否 | 否 |
| 管理 UI | 是（React 组件） | SaaS 仪表盘 | 否 |
| 自部署 | 是 | 是 | 是 |
| 多租户 | 是（organizationId） | 否 | 否 |

### 7.7 实施路线

```
Q2 2026 — 内部重构
  ├── 统一 self 主键（userId vs email）
  ├── 接入向量检索（embedding 字段启用）
  ├── 接入 applyDecay 定时任务
  └── 暴露 MCP 记忆工具

Q3 2026 — 抽象提取
  ├── 抽离 MemoryManager 为 @memorykit/core
  ├── 实现 Storage Adapter 接口
  ├── 编写 AI SDK Plugin
  └── 独立测试套件

Q4 2026 — 产品化
  ├── memorykit.dev 文档站
  ├── npm 发布 + GitHub 开源
  ├── SaaS 仪表盘（可选）
  └── 社区建设
```

---

## 八、记忆类型详解与示例

### 8.1 self — 用户画像

用户的完整 AI 认知画像，整个组织只有一个实例。

```json
{
  "objectType": "self",
  "objectId": "user_abc123",
  "name": "我的画像",
  "attributes": {
    "role": "投资总监 · 关注硬科技和 AI 赛道",

    "writing_style": "偏好简体中文回复，语气专业但不生硬。开头用「Hi + 名字」，结尾用「Best regards」。段落简短，重点加粗。不喜欢冗长的客套话，一封邮件不超过 5 句话。",

    "sample_emails": "📧 审批回复（同意）：\n\"Hi 张伟，\\n采购申请已审批通过，请按流程推进。如有变更请提前告知。\\nBest regards, Yang\"\n\n📧 汇报回复：\n\"Hi 李明，\\n收到，进展符合预期。两个关注点：\\n1. 设计稿终审时间能否提前到周三？\\n2. 预算使用率偏高，后续控制在 70% 以内。\\nBest regards, Yang\"",

    "reply_patterns": "同意类：直接给结论 + 一句行动指引，不超过 3 行\n拒绝/待定类：先说结论，再说原因和下一步，语气保持平和\n催促类：不直接催，而是问进展 + 给 deadline 提醒",

    "tone_preference": "专业但不生硬",
    "work_habits": "上午 10 点前集中处理审批类邮件...",
    "signature": "Best regards, Yang"
  }
}
```

### 8.2 person — 联系人画像

```json
{
  "objectType": "person",
  "objectId": "zhang.wei@acme.com",
  "name": "张伟",
  "attributes": {
    "role": "采购部经理",
    "company": "ACME Corporation",
    "communication_style": "极度务实，邮件从不寒暄...",

    "sample_interactions": "📨 张伟发来的典型邮件：\n\"采购申请：服务器 3 台，¥42,000。附报价单。请审批。\"\n→ 特点：无寒暄，直入主题\n\n📨 张伟的确认风格：\n\"收到\"\n→ 含义：等同于「同意，知道了」",

    "sensitivity": "财务数据、供应商报价",
    "relationship": "频繁合作方，Q1 合作了 3 个采购项目"
  }
}
```

### 8.3 preference — 业务规则

```json
{
  "objectType": "preference",
  "objectId": "approval-email-rules",
  "name": "审批邮件处理规则",
  "attributes": {
    "rule": "金额低于 ¥10,000 的常规采购审批，直接建议通过...",
    "context": "审批类邮件的自动化处理策略",
    "scope": "所有采购审批邮件",

    "examples": "📋 场景 1 — 低金额自动通过：\n收到：「办公用品采购 ¥8,000」\n→ AI 草拟回复：\"Hi 张伟，采购申请已审批通过\"\n\n📋 场景 2 — 中等金额等待确认：\n收到：「服务器采购 ¥35,000」\n→ AI 摘要关键信息 → 等待用户确认"
  }
}
```

---

## 九、注入 Prompt 的格式

MemoryManager 的记忆在 `planner.ts` 中被注入到 System Prompt：

```
## 记忆上下文（叙事型）

以下是与当前对话相关的历史记忆：
- [contact_profile] 张伟是采购部经理，偏好简洁沟通...
- [user_preference] 用户邮件写作风格: 偏好简体中文...

## 结构化记忆（知识卡片）

### 我的画像 (self)
- 角色: 投资总监
- 写作风格: 偏好简体中文...
- 参照邮件: 📧 审批回复..."Hi 张伟，采购已通过..."
- 回复模式: 同意类：结论 + 行动指引

### 张伟 (person · zhang.wei@acme.com)
- 职务: 采购部经理
- 沟通风格: 极度务实...
- 典型对话: 📨 "采购申请：服务器 3 台..."
```

---

## 十、总结

Flowmail 记忆系统的核心创新在于**三层记忆模型**（抽象 + 模式 + 样本）和
**结构化知识卡片**设计。这不只是"给 AI 加上记忆"，而是建立了一套
**从非结构化邮件中持续提炼结构化业务知识**的体系。

这套体系具备独立产品化的潜力——**MemoryKit** 可以成为 AI Agent 生态中的
标准记忆基础设施，填补 LangChain/Mem0 等工具在结构化知识管理上的空白。
