---
name: flowmail-setup-platform-app
description: Help users create an enterprise application on Feishu, DingTalk, or WeCom to enable OAuth integration with Flowmail. Uses browser automation to navigate developer consoles and submit credentials back via MCP.
metadata:
  {
    "openclaw":
      {
        "emoji": "🔧",
        "homepage": "https://flowmail.ai",
        "requires": { "env": ["FLOWMAIL_API_TOKEN"], "tools": ["browser"] },
        "primaryEnv": "FLOWMAIL_API_TOKEN"
      },
    "filePattern": [],
    "bashPattern": ["flowmail.*setup", "flowmail.*feishu", "flowmail.*dingtalk", "flowmail.*wecom"]
  }
---

# Flowmail Platform App Setup Skill

This skill guides AI agents through creating enterprise applications on Chinese workplace platforms (Feishu/Lark, DingTalk, WeCom) to enable Flowmail's OAuth integration with email read/send capabilities.

## When to Use

User says something like:
- "帮我设置 Flowmail 飞书接入"
- "Help me create a Feishu app for Flowmail"
- "帮我在钉钉开放平台创建应用"
- "设置企业微信和 Flowmail 的连接"

## Prerequisites

- User must be logged into the platform's admin/developer console in their browser
- User must have admin privileges on their organization
- Browser tool (Chrome DevTools MCP, Playwright, or built-in browser) must be available
- `FLOWMAIL_API_TOKEN` must be configured for credential submission

## Platform Reference

### Feishu (飞书)

| Item | Value |
|------|-------|
| Developer Console | `https://open.feishu.cn/app` |
| App Type | Enterprise Self-Built (企业自建应用) |
| Required Permissions | `mail:user_mailbox.message:readonly`, `mail:user_mailbox.message.subject:read`, `mail:user_mailbox.message.address:read`, `mail:user_mailbox.message.body:read`, `mail:user_mailbox.message:send` |
| Credential Names | App ID, App Secret |
| Email Capabilities | Read + Send |

**Steps:**
1. Navigate to `https://open.feishu.cn/app`
2. Click "创建企业自建应用" (Create Enterprise Self-Built App)
3. Fill in: App Name = "Flowmail", Description = "AI 邮件业务执行平台", upload an icon if needed
4. Click "创建" (Create)
5. Go to "权限管理" (Permission Management) in the left sidebar
6. Search for and enable each permission listed above
7. Go to "凭证与基础信息" (Credentials & Basic Info)
8. Copy the App ID and App Secret
9. Click "创建版本" (Create Version) and submit for admin review
10. Submit credentials to Flowmail via MCP tool `connect_platform`

### DingTalk (钉钉)

| Item | Value |
|------|-------|
| Developer Console | `https://open-dev.dingtalk.com` |
| App Type | Enterprise Internal (企业内部应用) |
| Required Permissions | `openid`, basic contact read |
| Credential Names | Client ID (AppKey), Client Secret (AppSecret) |
| Email Capabilities | None (DingTalk has no email API — recommend forwarding instead) |

**Steps:**
1. Navigate to `https://open-dev.dingtalk.com`
2. Click "应用开发" (App Development) → "创建应用" (Create App)
3. Select "企业内部开发" (Internal Development)
4. Fill in: App Name = "Flowmail", Description = "AI 邮件业务执行平台"
5. Go to "权限管理" (Permission Management)
6. Enable: "通讯录个人信息读权限", "个人手机号信息"
7. Go to app details, copy Client ID and Client Secret
8. Submit credentials to Flowmail via MCP tool `connect_platform`

**Important:** DingTalk does not provide email read/write APIs. After OAuth setup, email sync should use the forwarding method. Inform the user about this limitation.

### WeCom (企业微信)

| Item | Value |
|------|-------|
| Developer Console | `https://work.weixin.qq.com/wework_admin/frame#apps` |
| App Type | Enterprise Self-Built (自建应用) |
| Required Permissions | 邮件 (Email — includes send and receive) |
| Credential Names | Corp ID, Secret |
| Email Capabilities | Read + Send |

**Steps:**
1. Navigate to `https://work.weixin.qq.com/wework_admin/frame#apps`
2. Find "自建" (Self-Built) section, click "+创建应用" (Create App)
3. Fill in: App Name = "Flowmail", App Logo, Description = "AI 邮件业务执行平台"
4. Set visible range to desired departments/members
5. After creation, go to app details
6. Note the AgentId, then click "查看" to get the Secret
7. For Corp ID: go to "我的企业" (My Enterprise) page
8. Go to "企业应用" → "邮件" → API settings, add this app to "可调用应用" list
9. Submit credentials to Flowmail via MCP tool `connect_platform`

## Credential Submission

After obtaining credentials, call the Flowmail MCP tool:

```
Tool: connect_platform
Arguments:
  provider: "feishu" | "dingtalk" | "wecom"
  appId: "<the App ID / Client ID / Corp ID>"
  appSecret: "<the App Secret / Client Secret / Secret>"
```

## Error Handling

### User is not an admin
If the developer console shows "无权限" or similar access denied messages:
1. Stop browser automation
2. Inform the user they need admin privileges
3. Offer to generate a message they can send to their IT admin:

> Hi，我们团队在使用 Flowmail（AI 邮件助手），需要在 [平台名] 开放平台创建一个企业自建应用。请帮忙创建应用并提供 App ID 和 Secret。应用名称填「Flowmail」，需要申请邮件相关权限。谢谢！

### Permission approval pending
Some organizations require admin approval for permission requests. If permissions show "待审核" status:
1. Inform user that permissions are pending approval
2. Credentials can still be submitted — Flowmail will retry when permissions are granted

### Browser tool not available
If no browser tool is configured:
1. Open the developer console URL in user's default browser: `open <url>`
2. Provide step-by-step text instructions for manual completion
3. Ask user to paste the credentials back for MCP submission
