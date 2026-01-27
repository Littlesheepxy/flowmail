# Changelog

## 2026-01-12 v1.3.3

### Consolidated agent rules into single agents.md file

All coding agent guidelines have been consolidated into a single, comprehensive `agents.md` file in the repository root.

#### Removed files
- `claude.md` - Previous Claude-specific coding guide
- `.windsurfrules` - Windsurf editor rules
- `.cursor/rules/*.mdc` - All Cursor IDE rule files (7 files)

#### New files
- `agents.md` - Comprehensive 679-line guide covering:
  - Technology stack overview
  - Monorepo architecture and directory structure
  - Import conventions and path aliases
  - TypeScript best practices with code examples
  - React & Next.js patterns (Server vs Client Components)
  - API & Data Layer patterns (oRPC procedures, database queries)
  - Authentication & Authorization patterns
  - UI & Styling guidelines
  - Forms & Validation patterns
  - Internationalization
  - Configuration management
  - Tooling & Quality standards
  - Performance optimization guidelines
  - Code review checklist
- `claude.md` - Symlink to `agents.md` for Claude Code compatibility

This consolidation provides a single source of truth for all AI coding agents working with the codebase, regardless of the IDE or tool being used.

---

## 2026-01-10 v1.3.2

#### Package updates

- Updated all ORPC packages (`@orpc/client`, `@orpc/tanstack-query`, `@orpc/json-schema`, `@orpc/openapi`, `@orpc/server`, `@orpc/zod`) from `^1.11.2` to `1.13.2`

#### Code changes

- Removed experimental prefix from `SmartCoercionPlugin` import in `packages/api/orpc/handler.ts` (changed from `experimental_SmartCoercionPlugin` to `SmartCoercionPlugin`)

---

## 2026-01-02 v1.3.1

### Drizzle schema update for better-auth

Updated all drizzle schema files to be aligned with the changes in the latest better-auth version.

#### Schema updates

- **User table**: Added `displayUsername` field and `twoFactorEnabled` field with default value
- **Passkey table**: Added `aaguid` field for authenticator attestation GUID
- **Organization table**: Made `slug` field required (`notNull()`) and unique
- **Member table**: Added default value `"member"` for `role` field and added `cuid()` default function for `id` field
- **Invitation table**: Added `createdAt` field with default timestamp and default value `"pending"` for `status` field
- Added performance indexes on `invitation.organizationId` and `invitation.email` fields

#### Relation updates

- Updated `userRelations` to include `members` relation
- Changed `invitationRelations` from `inviter` to `user` for consistency with PostgreSQL schema
- Reorganized relation definitions to match PostgreSQL structure

---
## 2026-01-02 v1.3.0

### New design

- The UI design has been updated to a new, more modern look.

---

## 2025-12-22 v1.2.12

### Fixed Prisma configuration

#### Script updates
- Removed explicit `--schema=./prisma/schema.prisma` flags from all Prisma scripts (generate, push, migrate, studio)
- Scripts now use Prisma's default schema location, simplifying configuration

#### Configuration cleanup
- Moved `prisma.config.ts` file to the root of the database package

---

## 2025-12-21 v1.2.11

### Update dependencies

Updated next, react and react-dom to the latest versions.

---

## 2025-12-21 v1.2.10

### Fixed settings item component

Fixed an issue where the settings item component didn't apply the correct layout.

---

## 2025-12-17 v1.2.9

### Updated Prisma database push script

- Updated database `push` script to remove the deprecated `--skip-generate` flag

---

## 2025-12-17 v1.2.8

### Updated dependencies

#### Prisma major version upgrade
- Updated `@prisma/client` from `6.19.0` to `7.1.0`
- Updated `prisma` from `6.19.0` to `7.1.0`
- Updated `prisma-zod-generator` from `1.32.1` to `2.1.2`

#### Prisma configuration changes
- Moved `DATABASE_URL` configuration from `schema.prisma` datasource block to `prisma.config.ts` file
- The `url` field is now managed through the Prisma config file for better configuration management

#### Better-auth updates
- Updated `better-auth` from `1.4.4` to `1.4.7` in both web app and auth package
- Updated `@better-auth/passkey` from `^1.4.4` to `^1.4.7`

---

## 2025-12-16 v1.2.7

### TypeScript configuration improvements

#### Type safety enhancements
- Added explicit type assertions in Creem payment provider for better type safety

#### TypeScript config updates
- Added `jsx: "preserve"` to base TypeScript configuration
- Added `DOM.Iterable` to React library TypeScript configuration for better DOM type support

#### Cleanup
- Removed unused `test:webhook` script from payments package
- Removed unnecessary `type-check` script from tailwind config package

---

## 2025-12-16 v1.2.6

### Updated dependencies

- Updated `next` from `16.0.7` to `16.0.10`
- Updated `react` from `19.2.1` to `19.2.3`
- Updated `react-dom` from `19.2.1` to `19.2.3`

---

## 2025-12-16 v1.2.5

### Fixed prisma-zod-generator version

Pinned `prisma-zod-generator` to version `1.32.1` to prevent automatic upgrades to `1.32.2`, which contains breaking changes and is deprecated for Prisma 6.

---

## 2025-12-05 v1.2.4

### Updated DodoPayments integration

#### SDK upgrade
- Updated `dodopayments` package from `^2.5.0` to `^2.8.0`

#### Webhook improvements
- Refactored webhook handler to use SDK's built-in webhook verification instead of manual signature verification
- Moved webhook secret configuration to client initialization for better security
- Updated webhook event types to match new SDK version:
  - `checkout.session.completed` → `payment.succeeded`
  - `subscription.created` → `subscription.active`
  - `subscription.cancelled` → `subscription.expired`
  - Added support for `subscription.plan_changed` event
- Updated product ID extraction to use `product_cart` array structure from new SDK

---

## 2025-12-04 v1.2.3

### Improved admin list components

#### API changes
- Updated pagination parameters from `itemsPerPage`/`currentPage` to `limit`/`offset` for better consistency
- Changed `searchTerm` parameter to `query` across admin list endpoints
- Count functions now respect search queries, providing accurate pagination totals when filtering

#### Search improvements
- **Users list**: Now searches both name and email fields (case-insensitive)
- **Organizations list**: Improved to use case-insensitive search
- Search queries are now properly applied to both data fetching and count queries

#### UI improvements
- Replaced loading spinner with skeleton loaders for better visual feedback during data fetching
- Fixed pagination reset logic to prevent unnecessary page resets on initial component mount
- Improved loading state display with skeleton rows matching the table structure
- Fixed pagination display condition to properly check for total count

---

## 2025-12-03 v1.2.2

### Updated next, react and react-dom for security updates

A critical-severity vulnerability was found in react server components. We updated the related dependencies to the latest versions to fix the issue.

Read more about the issue here: https://vercel.com/changelog/cve-2025-55182

---

## 2025-12-01 v1.2.1

### Several small type issues fixed

Fixed type issues in ForgotPasswordForm, SetPasswordForm, ChangePasswordForm, and OrganizationRoleSelect components.

---

## 2025-12-01 v1.2.0

### Better-auth 1.4 upgrade

Upgraded `better-auth` from version `1.3.34` to `1.4.4`. This version introduces several breaking changes and improvements.

#### Migration steps

1. **Update dependencies:**
   - Update `better-auth` to `1.4.4` in both `apps/web/package.json` and `packages/auth/package.json`
   - Add `@better-auth/passkey` package (version `^1.4.4`) to `packages/auth/package.json`

2. **Update passkey plugin imports:**
   - In `packages/auth/auth.ts`: Change `import { passkey } from "better-auth/plugins/passkey"` to `import { passkey } from "@better-auth/passkey"`
   - In `packages/auth/client.ts`: Change `passkeyClient` import from `better-auth/client/plugins` to `import { passkeyClient } from "@better-auth/passkey/client"`

3. **Update magicLink callback signature:**
   - Change the `sendMagicLink` callback from `async ({ email, url }, request)` to `async ({ email, url }, ctx)`
   - Extract the request object from context: `const request = ctx?.request as Request`

4. **Update database schema:**
   - Run `pnpm db:push` or create a migration to add the following indexes:
     - `Session`: `@@index([userId])`
     - `Account`: `@@index([userId])`
     - `Verification`: `@@index([identifier])`
     - `Passkey`: `@@index([userId])` and `@@index([credentialID])`
     - `TwoFactor`: `@@index([secret])` and `@@index([userId])`
     - `Member`: `@@index([organizationId])` and `@@index([userId])`
     - `Invitation`: `@@index([organizationId])` and `@@index([email])`
   - Add `createdAt DateTime @default(now())` field to the `Invitation` model

These changes improve database query performance through additional indexes and align with better-auth 1.4's new plugin architecture where passkey functionality is now a separate package.

---

## 2025-11-25 v1.1.4

### Fix OpenAPI schema

Fixed was an issue that would cause custom OpenAPI endpoints to not be reachable throught the `/api` path.

---

## 2025-11-23 v1.1.3

### Fix active sessions block

Fixed an issue where the removing the current session from the active sessions block was causing a redirect loop on the login page.

---

## 2025-11-20 v1.1.2

### Fix missing organization settings item in navbar

When in the config file the `hideOrganization` option is set to true, the organization settings item was missing in the navbar.

---

## 2025-11-16 v1.1.1

### Remove unnecessary font-sans variable

Removed the unnecessary `--font-sans` variable from the theme.css file as it is already defined the the `layout.tsx` file where the font is imported and injected to the html element.

### Updated dependencies

All production and development dependencies have been updated to the latest versions.

---

## 2025-11-12 v1.1.0

### Add claude.md file

For a better coding experience with Claude Code, we have added a `claude.md` file to the root of the repository.
This file contains the coding guidelines for the project, and is used by Claude Code to generate code.

---

## 2025-11-12 v1.0.9

### Fix passkeys reload issue

Fixed an issue where the passkeys list was not being reloaded correctly after adding or deleting a passkey.

---

## 2025-11-12 v1.0.8

### Fix missing fields in auth schema

Added missing fields (`aaguid` for Passkey and `displayUsername` for User) in the schema.
This was causing the passkeys creation to fail.

---

## 2025-11-12 v1.0.7

### Fixed mobile menu closing issue

Fixed an issue where the mobile menu was not closing when clicking on a menu item.

---

## 2025-11-11 v1.0.6

### Fix content-collections schema

The content-collections schema will soon require the `content` field to be present in the schema, which previously was automatically generated. 
We have added it to the schema to avoid breaking changes with the upcoming content-collections version.

### Updated production dependencies

All production dependencies have been updated to the latest versions.

### Fixed AI chat component

Fixed a validation issue in the AI chat component that was causing the `addMessageToChat` procedure to fail.

---

## 2025-11-11 v1.0.5

### Fix formatting

Ran `pnpm format` to fix formatting issues in the codebase.

### Updated all dependencies

Production and development dependencies have been updated to the latest versions.

---

## 2025-11-08 v1.0.4

### Fixed AI chat component

Fixed a type issue in the AI chat component.

### Fixed Tailwind CSS wrapper component in mail templates

As reported in #2173, some Tailwind CSS classes were not being applied correctly in the email wrapper.

### Added typescript as dev dependency to web app

Added typescript as dev dependency to fix the `pnpm type-check` command.

---

## 2025-11-08 v1.0.3

### Fixed schema error in addMessageToChat procedure

Fixed a schema error in the `addMessageToChat` procedure that was causing the OpenAPI schema to be invalid.

---

## 2025-11-03 v1.0.2

### Updated dependencies

---

## 2025-11-03 v1.0.1

### Updated React type definitions

Updated `@types/react` and `@types/react-dom` from version 19.0.0 to 19.2.2 to include the latest type definitions and bug fixes for React 19.

The pnpm overrides have been consolidated to the root `package.json` for better consistency across the monorepo.

### Optimized pnpm dependency installation

Added `onlyBuiltDependencies` configuration to pnpm settings to optimize installation time by only building Prisma-related packages (`@prisma/client`, `prisma`, and `prisma-zod-generator`) when needed. This reduces unnecessary rebuilds and speeds up dependency installation in the monorepo.

### Added pg dependency

Added `pg` (PostgreSQL client) as a dependency to support the Prisma Rust-free client migration. The `pg` package is required by the Prisma database adapter for PostgreSQL connections.

---

## 2025-11-03 v1.0.0

### Prisma client migration to Rust-free client

In order to reduce the bundle size of the client and improve performance, we have migrated to the Rust-free Prisma client.

#### Migration steps

If you are upgrading your supastarter project to this version, you need to update the way your prisma client is generated:

1. Update `prisma` and `@prisma/client` to the latest version.

2. In the `schema.prisma` file, change the `provider` to `prisma-client`, the `output` to `./generated` and set the `engineType` to `client`.

3. Update the `packages/database/prisma/client.ts` like this:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const prismaClientSingleton = () => {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not set");
	}

	const adapter = new PrismaPg({
		connectionString: process.env.DATABASE_URL,
	});

	return new PrismaClient({ adapter });
};

declare global {
	var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

// biome-ignore lint/suspicious/noRedeclare: This is a singleton
const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
	globalThis.prisma = prisma;
}

export { prisma as db };
```

In case are using a different database than PostgreSQL, see the following documentation on which adapter to use: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/no-rust-engine#3-install-the-driver-adapter

### Next.js 16 migration

If you are updating an existing project, work through the following steps to align with the new Next.js 16 defaults and Supastarter conventions:

1. Upgrade  `next`, `react`, and `react-dom` to their latest stable releases in both `package.json` files (`package.json` at the root and `apps/web/package.json` if it exists).

2. Rename the middleware entry point:
   - Move `apps/web/middleware.ts` to `apps/web/proxy.ts`.
   - Inside the renamed file update the exported handler to `export function proxy(...)` (it was previously `middleware`).

3. Remove the inline ESLint configuration from `apps/web/next.config.ts`

4. Update the marketing docs layout `apps/web/app/(marketing)/[locale]/docs/[[...path]]/layout.tsx`, by changing the `DocsLayout` prop from `disableThemeSwitch` to `themeSwitch={{ enabled: true }}`.

See https://nextjs.org/docs/app/guides/upgrading/version-16 for full migration guide (beyond the supastarter codebase).

---

### Biome 2.3 upgrade

We have upgraded to Biome 2.3 which introduces some changes to how CSS files are handled and it currently doesn't support the format in which Tailwind CSS 4 is configured, so you need to update the `biome.json` file to ignore the `globals.css` file for now:

```jsonc
{
    "files": {
        "includes": [
            "**",
            "!zod/index.ts",
            "!tailwind-animate.css",
            "!!**/globals.css" // <- ignore this file
        ]
    },
    "css": {
        "parser": {
            "tailwindDirectives": true // <- enable tailwind directives parsing
        }
    }
}
```
