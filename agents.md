# Coding Agent Guidelines

> Comprehensive guide for AI coding agents working with this supastarter Next.js codebase.

## Purpose

Use this document whenever generating or updating code in this repository. Mirror existing project conventions; do not invent new patterns without a strong reason.

---

## Technology Stack

You are an expert in:

- **TypeScript** – Strict typing, interfaces over type aliases
- **Node.js** – Server-side runtime (≥20)
- **Next.js App Router** – React Server Components, layouts, route handlers
- **React** – Functional components, hooks
- **Shadcn UI & Radix** – Accessible, composable primitives
- **Tailwind CSS** – Utility-first styling
- **oRPC** – Type-safe RPC layer
- **Better Auth** – Authentication with passkeys, magic links, organizations
- **Drizzle/Prisma** – Database ORM
- **React Hook Form + Zod** – Forms and validation
- **TanStack Query** – Client-side data fetching and caching

---

## Architecture Overview

### Monorepo Structure

```
/
├── apps/web/                    # Next.js application
│   ├── app/                     # App Router routes
│   │   ├── (marketing)/         # Public marketing pages
│   │   ├── (saas)/              # Protected SaaS application
│   │   ├── auth/                # Authentication pages
│   │   └── api/                 # API route handlers
│   ├── modules/                 # Shared UI & feature modules
│   │   ├── marketing/           # Marketing feature components
│   │   ├── saas/                # SaaS feature components
│   │   ├── shared/              # Cross-cutting components
│   │   └── ui/                  # Shadcn UI components
│   ├── content/                 # MDX content (docs, legal, blog)
│   └── tests/                   # Playwright E2E tests
├── packages/                    # Shared backend packages
│   ├── api/                     # oRPC procedures and HTTP handlers
│   ├── auth/                    # Better Auth configuration
│   ├── database/                # Prisma/Drizzle schema and queries
│   ├── ai/                      # AI integrations
│   ├── i18n/                    # Translations and locale utilities
│   ├── logs/                    # Logging configuration
│   ├── mail/                    # Email providers and templates
│   ├── payments/                # Payment processing (Stripe, etc.)
│   ├── storage/                 # File storage (S3, etc.)
│   └── utils/                   # Shared utility functions
├── config/                      # Application configuration
└── tooling/                     # Build tooling and shared configs
```

### Import Conventions

Use package exports instead of deep relative imports:

```typescript
// ✅ Good
import { auth } from "@repo/auth";
import { db } from "@repo/database";
import { config } from "@repo/config";
import { orpcClient } from "@shared/lib/orpc-client";

// ❌ Bad
import { auth } from "../../../packages/auth/auth";
```

### Path Aliases

The following path aliases are configured:

| Alias | Path |
|-------|------|
| `@repo/*` | `packages/*` |
| `@shared/*` | `apps/web/modules/shared/*` |
| `@saas/*` | `apps/web/modules/saas/*` |
| `@marketing/*` | `apps/web/modules/marketing/*` |
| `@ui/*` | `apps/web/modules/ui/*` |

---

## Core Coding Principles

### TypeScript

- Write TypeScript everywhere; prefer interfaces over type aliases for object shapes
- Avoid enums; use maps/records or union literals instead
- Use functional components with TypeScript interfaces
- Export types alongside implementations when needed

```typescript
// ✅ Good
interface UserProps {
  name: string;
  email: string;
  isActive: boolean;
}

const USER_ROLES = {
  admin: "admin",
  user: "user",
} as const;

type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// ❌ Bad
type UserProps = { name: string; email: string };
enum UserRole { Admin, User }
```

### Functions & Components

- Export React components as named functions; avoid default exports and classes
- Prefer pure functions declared with the `function` keyword
- Use descriptive camelCase identifiers (`isLoading`, `canSubmit`, `hasError`)
- Structure files: exported component, subcomponents, helpers, static content, types

```typescript
// ✅ Good
export function UserCard({ user }: UserCardProps) {
  const isActive = user.status === "active";
  return <div>{/* ... */}</div>;
}

function formatUserName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

// ❌ Bad
export default class UserCard extends Component {}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Directories | lowercase with dashes | `components/auth-wizard` |
| Components | PascalCase | `LoginForm.tsx` |
| Variables/Functions | camelCase | `isLoading`, `handleSubmit` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES` |
| Types/Interfaces | PascalCase | `UserProps`, `AuthConfig` |

---

## React & Next.js Patterns

### Server vs Client Components

- **Default to React Server Components** – Only add `"use client"` when interactivity or browser APIs are required
- Keep client components small and focused
- Wrap client components in `Suspense` with tailored fallbacks

```typescript
// Server Component (default)
export async function UserProfile({ userId }: { userId: string }) {
  const user = await getUser(userId);
  return <UserCard user={user} />;
}

// Client Component (only when needed)
"use client";

export function InteractiveCounter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Minimize Client-Side State

- Minimize `useEffect` and `useState`; favor React Server Components
- Use `nuqs` for URL search parameter state management
- Avoid client components for data fetching or state management

### Data Fetching

- Use Next.js data-fetching primitives (Route Handlers, Server Actions, `fetch` with caching tags)
- Colocate route-specific helpers under the route directory
- Share cross-route logic via `apps/web/modules`
- Honor caching and revalidation patterns already in the repo

```typescript
// Server-side data fetching in layout/page
export default async function Layout({ children }: PropsWithChildren) {
  const session = await getSession();
  
  if (!session) {
    redirect("/auth/login");
  }
  
  return children;
}
```

### Error Handling

- Use `notFound()`, `redirect()`, or custom error boundaries
- Don't throw raw errors; handle them gracefully

```typescript
import { notFound, redirect } from "next/navigation";

export default async function Page({ params }: PageProps) {
  const data = await getData(params.id);
  
  if (!data) {
    notFound();
  }
  
  if (!data.isAccessible) {
    redirect("/unauthorized");
  }
  
  return <Content data={data} />;
}
```

---

## API & Data Layer

### oRPC Procedures

API logic lives in `packages/api/modules`. Structure procedures with:

1. Route metadata (method, path, tags)
2. Input validation with Zod
3. Middleware (auth, locale)
4. Handler implementation

```typescript
// packages/api/modules/[feature]/procedures/[action].ts
import { publicProcedure, protectedProcedure } from "../../../orpc/procedures";
import { z } from "zod";

export const createItem = protectedProcedure
  .route({
    method: "POST",
    path: "/items",
    tags: ["Items"],
    summary: "Create a new item",
  })
  .input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }))
  .handler(async ({ input, context }) => {
    // Implementation
  });
```

### Procedure Types

- `publicProcedure` – No authentication required
- `protectedProcedure` – Requires authenticated session
- `adminProcedure` – Requires admin role

### Database Queries

- Use the generated database clients from `@repo/database`
- Never instantiate Prisma or Drizzle directly in app code
- Keep queries in `packages/database/[orm]/queries/`

```typescript
// packages/database/drizzle/queries/users.ts
export async function getUserById(id: string) {
  return await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.id, id),
  });
}
```

### Client-Side Data Fetching

Use TanStack Query with oRPC utilities:

```typescript
"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery } from "@tanstack/react-query";

export function ItemsList() {
  const { data, isLoading } = useQuery(
    orpc.items.list.queryOptions()
  );
  
  const createMutation = useMutation(
    orpc.items.create.mutationOptions()
  );
  
  // ...
}
```

---

## Authentication & Authorization

### Session Handling

- Use helpers from `@repo/auth` for session handling
- Server-side: `getSession()` from `@saas/auth/lib/server`
- Client-side: `useSession()` hook from `@saas/auth/hooks/use-session`

```typescript
// Server Component
import { getSession } from "@saas/auth/lib/server";

export default async function ProtectedPage() {
  const session = await getSession();
  // ...
}

// Client Component
"use client";
import { useSession } from "@saas/auth/hooks/use-session";

export function UserInfo() {
  const { user, loaded } = useSession();
  // ...
}
```

### Organization Scoping

- Respect organization scoping for multi-tenant features
- Access control helpers live in `apps/web/modules/saas/*/lib`
- Use `useActiveOrganization()` hook for organization context

```typescript
"use client";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";

export function OrgSettings() {
  const { activeOrganization, isOrganizationAdmin } = useActiveOrganization();
  
  if (!isOrganizationAdmin) {
    return <p>Access denied</p>;
  }
  
  // ...
}
```

### Auth Flow Consistency

When updating auth flows, ensure:
- Email templates in `packages/mail/emails` are updated
- Audit hooks remain consistent
- Locale detection works correctly

---

## UI & Styling

### Component Library

- Use Shadcn UI components from `@ui/components`
- Compose with Radix primitives when customization is needed
- Import the `cn` helper for conditional class names

```typescript
import { Button } from "@ui/components/button";
import { cn } from "@ui/lib";

export function CustomButton({ variant, className }: Props) {
  return (
    <Button className={cn("custom-styles", className)} variant={variant}>
      Click me
    </Button>
  );
}
```

### Tailwind CSS

- Follow mobile-first responsive utility ordering
- Respect design tokens from `tooling/tailwind/theme.css`
- Use consistent spacing and color variables

```typescript
// Mobile-first responsive design
<div className="flex flex-col gap-4 md:flex-row md:gap-6 lg:gap-8">
  {/* Content */}
</div>
```

### Image Optimization

- Use `next/image` with explicit `width`/`height`
- Prefer WebP format when possible
- Implement lazy loading for non-critical visuals

```typescript
import Image from "next/image";

<Image
  src="/images/hero.webp"
  alt="Hero image"
  width={1200}
  height={630}
  priority={false}
  loading="lazy"
/>
```

---

## Forms & Validation

### Form Implementation

- Use `react-hook-form` for form state management
- Use `zod` for schema validation
- Reuse existing form abstractions before creating new ones

```typescript
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ui/components/form";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});

type FormValues = z.infer<typeof formSchema>;

export function ContactForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    // Handle submission
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* More fields... */}
      </form>
    </Form>
  );
}
```

### Shared Validation Schemas

- Define validation schemas in API module types for reuse
- Import schemas from `@repo/api/modules/[feature]/types`

```typescript
// packages/api/modules/contact/types.ts
import { z } from "zod";

export const contactFormSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(10),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
```

---

## Internationalization

### Translation Strings

- Source strings via i18n utilities in `packages/i18n`
- Use `useTranslations()` hook in components
- Content collections live in `apps/web/content`

```typescript
import { useTranslations } from "next-intl";

export function WelcomeMessage() {
  const t = useTranslations();
  
  return (
    <h1>{t("home.welcome.title")}</h1>
  );
}
```

### Locale Handling

- Honor locale detection from `config.i18n`
- Use correct cookie naming conventions (`NEXT_LOCALE`)
- Server components: use `setRequestLocale(locale)`

```typescript
// Server Component with locale
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  
  return <Content />;
}
```

---

## Configuration

### Application Config

Central configuration lives in `config/index.ts`:

```typescript
import { config } from "@repo/config";

// Access configuration
config.appName;           // Application name
config.i18n.defaultLocale; // Default locale
config.auth.enableSignup;  // Auth settings
config.payments.plans;     // Payment plans
config.organizations.enable; // Organization features
```

### Environment Variables

- Server-only variables: No prefix
- Client-accessible variables: `NEXT_PUBLIC_` prefix
- Never commit secrets; use `.env.local`

---

## Tooling & Quality

### Package Manager

- Use **pnpm** for package management
- Run workspace-wide commands via **Turbo**

```bash
pnpm dev      # Start development server
pnpm build    # Build all packages
pnpm lint     # Run linting
pnpm format   # Format code
```

### Code Quality

- Linting and formatting use **Biome**
- Keep files Biome-clean before committing
- Target Node.js ≥ 20 with ESM-compatible imports

### Testing

- E2E tests use **Playwright** in `apps/web/tests`
- Run tests with `pnpm test`

### Adding Dependencies

- Add dependencies at the correct workspace package
- Wire up exports through the relevant `index.ts`
- Use the latest stable versions

---

## Performance Optimization

### Core Web Vitals

Optimize for LCP, CLS, and FID:

- Minimize `"use client"` directives
- Use dynamic imports for non-critical components
- Implement proper image optimization
- Avoid layout shifts with proper sizing

```typescript
import dynamic from "next/dynamic";

// Lazy load non-critical components
const HeavyChart = dynamic(() => import("./HeavyChart"), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});
```

### Client Component Guidelines

Limit `"use client"` to:
- Components requiring browser APIs
- Interactive elements (forms, modals)
- Small, focused client boundaries

Avoid `"use client"` for:
- Data fetching
- Complex state management
- Layout components

---

## Documentation & Change Management

### Documentation Updates

- Update relevant MDX docs under `apps/web/content` when altering user-facing behavior
- Keep README files current with setup instructions

### Changelog

- Log noteworthy changes in `CHANGELOG.md` for consumer-impacting changes
- Follow conventional commit format: `feat:`, `fix:`, `docs:`, `refactor:`

---

## Best Practices Summary

### When Adding Features

1. Inspect neighboring files for patterns before writing new code
2. Prefer incremental, well-scoped changes over sweeping rewrites
3. Ensure new features have corresponding server and client stories (UI, API, data layer, emails if needed)
4. Test the feature locally before considering it complete

### Code Review Checklist

- [ ] TypeScript types are accurate and complete
- [ ] No `any` types without justification
- [ ] Server Components used where possible
- [ ] Forms use react-hook-form + zod
- [ ] API procedures follow existing patterns
- [ ] Translations added for user-facing strings
- [ ] Mobile-first responsive design
- [ ] Accessibility considered (Radix primitives)
- [ ] No console.log statements in production code
- [ ] Biome linting passes

### When in Doubt

- Inspect neighboring files for patterns before writing new code
- Ask for clarification on product requirements rather than guessing
- Prefer incremental, well-scoped changes over sweeping rewrites
- Follow the official documentation at [supastarter.dev/docs/nextjs](https://supastarter.dev/docs/nextjs)
