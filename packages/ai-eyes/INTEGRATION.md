# @ai-eyes Integration Guide

## Overview

`@ai-eyes` is a proactive AI help SDK that detects user confusion and offers
contextual assistance. To provide **meaningful** help, it needs to know **which
part of your app** the user is interacting with.

This is done through three HTML attributes:

| Attribute | Purpose | Required? |
|-----------|---------|-----------|
| `data-module="name"` | Identify feature areas | **Yes** |
| `data-section="name"` | Sub-module granularity | Optional |
| `data-ai-eyes-ignore` | Exclude sensitive areas | Recommended |

---

## Quick Start (5 minutes)

### 1. Install

```bash
npm install @ai-eyes/core @ai-eyes/react @ai-eyes/ai
```

### 2. Tag Your Modules

Add `data-module` to the root element of each major feature area:

```tsx
// pages/dashboard.tsx
export default function Dashboard() {
  return (
    <div data-module="dashboard">
      {/* your dashboard content */}
    </div>
  );
}
```

```tsx
// components/Sidebar.tsx
export function Sidebar() {
  return (
    <nav data-module="navigation">
      {/* nav links */}
    </nav>
  );
}
```

### 3. Protect Sensitive Areas

```tsx
<form data-ai-eyes-ignore>
  <input type="password" />
</form>
```

### 4. Wrap Your App

```tsx
import { AiEyesKit } from "@ai-eyes/react";

export default function Layout({ children }) {
  return (
    <AiEyesKit analyzeUrl="/api/ai-eyes/analyze">
      {children}
    </AiEyesKit>
  );
}
```

### 5. Create the API Route

```ts
// app/api/ai-eyes/analyze/route.ts (Next.js)
import { createAnalyzeHandler } from "@ai-eyes/ai/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export const POST = createAnalyzeHandler({
  generateText,
  model: openai("gpt-4o-mini"),
  maxTokens: 200,
});
```

That's it. The eye character appears, tracks the mouse, and proactively helps
confused users with full module context.

---

## How Module Detection Works

When a user clicks, scrolls, or types, the SDK walks up the DOM tree from the
event target to find the nearest `data-module` attribute:

```
<div data-module="settings">           ← module: "settings"
  <section data-section="security">    ← section: "security"
    <form>
      <button>Change Password</button> ← click event fires here
    </form>
  </section>
</div>
```

The recorded action becomes:
```json
{
  "type": "click",
  "module": "settings",
  "target": "[button] \"Change Password\"",
  "detail": { "section": "security" }
}
```

Without `data-module`, the action would just be:
```json
{
  "type": "click",
  "target": "[button] \"Change Password\""
}
```

The AI can't distinguish "confused in settings" from "confused in billing"
without module context.

---

## Module Tagging Strategy

### What to Tag

| Component Type | Tag? | Example |
|----------------|------|---------|
| Page/route components | **Yes** | `data-module="dashboard"` |
| Persistent layout regions | **Yes** | `data-module="navigation"` |
| Major feature panels | **Yes** | `data-module="chat"` |
| Modal/dialog with distinct purpose | **Maybe** | `data-module="create-project"` |
| UI primitives (Button, Card) | **No** | — |
| Error boundaries / wrappers | **No** | — |
| Individual list items | **No** | tag the list container instead |

### Naming Convention

- **Lowercase kebab-case**: `data-module="user-settings"`
- **Noun-based**: `"billing"` not `"pay"`
- **Match route segments**: `/projects` → `"projects"`
- **Suffix `-detail`** for single-item views: `"project-detail"`

### Typical App Coverage

```
data-module="navigation"      // sidebar or top nav
data-module="dashboard"        // main dashboard
data-module="projects"         // project list
data-module="project-detail"   // single project view
data-module="settings"         // settings page
data-module="billing"          // billing/payments
data-module="notifications"    // notification center
data-module="search"           // global search
```

Most apps need **5–15 module tags** to get excellent context coverage.

---

## Sub-Module Sections

For large modules, add `data-section` to distinguish logical areas:

```tsx
<div data-module="settings">
  <section data-section="profile">...</section>
  <section data-section="security">...</section>
  <section data-section="integrations">...</section>
</div>
```

**Rule of thumb**: use `data-section` when a module has **3+ distinct
functional areas** and you want the AI to differentiate between them.

---

## Privacy Controls

### `data-ai-eyes-ignore`

Add this attribute to any element whose child interactions should **never** be
recorded:

```tsx
<div data-ai-eyes-ignore>
  {/* Nothing inside here is tracked */}
</div>
```

### Must-Protect Areas

| Area | Why |
|------|-----|
| Password / auth forms | Credential safety |
| Payment forms (card numbers) | PCI compliance |
| Personal data (SSN, gov ID) | PII protection |
| API key / secret displays | Security |

The attribute inherits — adding it to a parent protects all descendants.

---

## Advanced Configuration

### Recorder Options

```tsx
<AiEyesKit
  analyzeUrl="/api/ai-eyes/analyze"
  recorderDuration={60_000}       // 60s rolling window (default: 30s)
  recorderConfig={{
    maxEntries: 500,              // max buffered actions (default: 200)
    trackKeyboard: true,          // count keystrokes (default: true)
    trackFocus: true,             // track focus/blur on inputs (default: true)
    trackNavigation: true,        // track SPA route changes (default: true)
    trackErrors: true,            // capture JS errors (default: true)
    trackResize: false,           // track window resize (default: false)
  }}
>
  {children}
</AiEyesKit>
```

### Custom AI Adapter

```tsx
import { AiEyesProvider, AiEyes } from "@ai-eyes/react";
import { AnalyzerEngine, createOpenAiRestAdapter } from "@ai-eyes/ai";

const analyzer = new AnalyzerEngine({
  adapter: createOpenAiRestAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
  }),
});
```

### Rule-Based Adapter (no AI cost)

```tsx
import { createRuleBasedAdapter } from "@ai-eyes/ai";

const adapter = createRuleBasedAdapter([
  {
    match: (event) => event.context.route?.includes("/settings"),
    message: "Need help with settings? Check the docs at /help/settings",
    action: "open_help",
  },
]);
```

---

## AI Agent Integration (Skill)

If you use **Cursor**, **Claude**, or another AI coding assistant, you can use
the bundled Skill to automatically tag modules in your project:

```
packages/ai-eyes/skills/ai-eyes-integration/SKILL.md
```

Copy this file to your project's `.cursor/skills/` directory, and your AI
assistant will know how to identify and tag modules when you ask it to
"integrate ai-eyes" or "tag modules for ai-eyes".

---

## Framework Examples

### Next.js App Router

```tsx
// app/layout.tsx
import { AiEyesKit } from "@ai-eyes/react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AiEyesKit analyzeUrl="/api/ai-eyes/analyze">
          <nav data-module="navigation">{/* ... */}</nav>
          <main>{children}</main>
        </AiEyesKit>
      </body>
    </html>
  );
}

// app/dashboard/page.tsx
export default function DashboardPage() {
  return <div data-module="dashboard">{/* ... */}</div>;
}
```

### Vite + React

```tsx
// src/App.tsx
import { AiEyesKit } from "@ai-eyes/react";

export function App() {
  return (
    <AiEyesKit analyzeUrl="/api/ai-eyes/analyze">
      <Router>
        <Sidebar /> {/* has data-module="navigation" */}
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Router>
    </AiEyesKit>
  );
}
```

---

## Verification

After tagging, open DevTools console and check that actions include modules:

1. Open your app
2. Click around in different sections
3. In console, run:

```js
// If using AiEyesProvider, the recorder is accessible via React DevTools
// or you can temporarily expose it for debugging:
window.__aiEyesRecorder?.getActions()
```

Each action should have a `module` field matching your tags.
