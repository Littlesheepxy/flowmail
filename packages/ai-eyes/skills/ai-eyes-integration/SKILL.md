---
name: ai-eyes-integration
description: >-
  Integrate @ai-eyes SDK into any React/Next.js project. Automatically identify
  UI modules and add data-module, data-section, data-ai-eyes-ignore attributes.
  Use when setting up ai-eyes, tagging modules, or asking "how do I integrate
  AI Eyes into my project".
---

# @ai-eyes Module Tagging Guide

This skill teaches you how to identify and tag UI modules in any React/Next.js
project so that `@ai-eyes` can provide meaningful, context-aware AI assistance.

## Why Module Tagging Matters

Without `data-module`, the AI sees raw DOM events like "user clicked a button"
— meaningless. With tags, it sees "user clicked [Save] in the **settings**
module after 3 failed attempts" — actionable context.

---

## Step 1: Identify Modules

Scan the project for **top-level feature areas**. Each page or major UI section
that represents a distinct user intent is a module.

### How to Find Modules

1. Look at the **router/pages directory** (`app/`, `pages/`, `src/routes/`):

```
app/
├── dashboard/     → module: "dashboard"
├── settings/      → module: "settings"
├── projects/      → module: "projects"
│   └── [id]/      → module: "project-detail"
├── billing/       → module: "billing"
└── inbox/         → module: "inbox"
```

2. Look at **sidebar/navigation items** — each nav link typically maps to a module.

3. Look at **major layout regions** that persist across routes:
   - Navigation bar → `data-module="navigation"`
   - Sidebar → `data-module="sidebar"`
   - Global search → `data-module="search"`

### Module Naming Convention

| Rule | Example |
|------|---------|
| Lowercase, kebab-case | `data-module="user-settings"` |
| Noun-based (what it IS, not what it does) | `"billing"` not `"pay"` |
| Match the route segment when possible | Route `/projects` → `"projects"` |
| Use `-detail` suffix for single-item views | `"project-detail"` |
| Use `-list` suffix only if ambiguous | `"invoice-list"` vs `"invoice-detail"` |

---

## Step 2: Add `data-module` Attributes

Add `data-module` to the **root element** of each module's main component.

### Pattern: Page-Level Module

```tsx
export default function SettingsPage() {
  return (
    <div data-module="settings">
      {/* page content */}
    </div>
  );
}
```

### Pattern: Layout Region

```tsx
export function AppSidebar() {
  return (
    <nav data-module="navigation">
      {/* nav items */}
    </nav>
  );
}
```

### Pattern: Reusable Feature Component

If a component renders as a major feature block (not a UI primitive):

```tsx
export function NotificationCenter() {
  return (
    <div data-module="notifications">
      {/* notification list */}
    </div>
  );
}
```

### Where NOT to Add `data-module`

- UI primitives: `<Button>`, `<Card>`, `<Modal>` (too granular)
- Utility wrappers: `<ErrorBoundary>`, `<Suspense>` (not user-facing features)
- Repeated list items: individual `<TodoItem>` (the parent list is the module)

---

## Step 3: Add `data-section` for Sub-Module Granularity (Optional)

Within a large module, use `data-section` to distinguish logical areas:

```tsx
<div data-module="settings">
  <section data-section="profile">
    {/* name, avatar */}
  </section>
  <section data-section="security">
    {/* password, 2FA */}
  </section>
  <section data-section="integrations">
    {/* connected apps */}
  </section>
</div>
```

The recorder captures both: `{ module: "settings", section: "security" }`.

Use `data-section` when:
- A module has 3+ distinct functional areas
- You want to distinguish "user confused in settings/security" vs "settings/profile"

---

## Step 4: Mark Sensitive Areas with `data-ai-eyes-ignore`

Prevent recording of interactions in privacy-sensitive regions:

```tsx
<form data-ai-eyes-ignore>
  <input type="password" />
  <input name="credit-card" />
</form>
```

### Must-Ignore Areas

| Area | Reason |
|------|--------|
| Password fields / auth forms | Credential safety |
| Payment / billing forms | PCI compliance |
| Personal data forms (SSN, ID) | PII protection |
| Admin-only debug panels | Internal exposure |

The attribute is inherited — adding it to a parent skips all children.

---

## Step 5: Integrate `@ai-eyes` SDK

### Minimal Setup (one component)

```tsx
import { AiEyesKit } from "@ai-eyes/react";

export default function RootLayout({ children }) {
  return (
    <AiEyesKit analyzeUrl="/api/ai-eyes/analyze">
      {children}
    </AiEyesKit>
  );
}
```

### API Route (Next.js)

```ts
// app/api/ai-eyes/analyze/route.ts
import { createAnalyzeHandler } from "@ai-eyes/ai/server";

export const POST = createAnalyzeHandler({
  generateText: yourGenerateTextFn,
  model: yourModel,
  maxTokens: 200,
});
```

### Advanced Setup (full control)

```tsx
import { AiEyesProvider, AiEyes } from "@ai-eyes/react";
import { AnalyzerEngine, createVercelAiAdapter } from "@ai-eyes/ai";

const analyzer = new AnalyzerEngine({
  adapter: createVercelAiAdapter({ apiUrl: "/api/ai-eyes/analyze" }),
});

export function AppShell({ children }) {
  const handleConfusion = async (event) => analyzer.analyze(event);

  return (
    <AiEyesProvider
      config={{
        recorder: { durationMs: 30_000, maxEntries: 200 },
      }}
      onConfusion={handleConfusion}
    >
      {children}
      <AiEyes size={48} position="bottom-right" draggable />
    </AiEyesProvider>
  );
}
```

---

## Quick Checklist

When integrating `@ai-eyes` into a new project:

- [ ] Identify all page-level modules from routes/navigation
- [ ] Add `data-module` to each module's root element
- [ ] Add `data-module="navigation"` to the main nav/sidebar
- [ ] (Optional) Add `data-section` to large modules with 3+ areas
- [ ] Add `data-ai-eyes-ignore` to all auth/payment/PII forms
- [ ] Wrap the app in `<AiEyesKit>` or `<AiEyesProvider>`
- [ ] Create the `/api/ai-eyes/analyze` route
- [ ] Verify with browser DevTools: click around, check console for recorded actions with `module` field

---

## Attribute Reference

| Attribute | Placement | Effect |
|-----------|-----------|--------|
| `data-module="name"` | Root of feature component | Tags all child interactions with this module name |
| `data-section="name"` | Sub-region within a module | Adds section granularity to actions |
| `data-ai-eyes-ignore` | Sensitive form/container | Excludes all child interactions from recording |
