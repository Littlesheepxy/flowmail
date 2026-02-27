# Changelog

## 2026-02-05 v2.0.3

### Radix UI dependency consolidation

#### Unified Radix UI package migration
- **Major dependency update**: Migrated from individual `@radix-ui/react-*` packages to unified `radix-ui` package (v1.4.3)
- **Consolidated dependencies**: Replaced 13 separate Radix UI packages with a single `radix-ui` package
- **Updated all UI components** to use new unified package imports:
  - `accordion.tsx`: Updated to use `Accordion` from `radix-ui`
  - `alert-dialog.tsx`: Updated to use `AlertDialog` from `radix-ui`
  - `avatar.tsx`: Updated to use `Avatar` from `radix-ui`
  - `button.tsx`: Updated to use `Slot` and `Slottable` from `radix-ui`
  - `dialog.tsx`: Updated to use `Dialog` from `radix-ui`
  - `dropdown-menu.tsx`: Updated to use `DropdownMenu` from `radix-ui`
  - `form.tsx`: Updated to use `Label` and `Slot` from `radix-ui`
  - `label.tsx`: Updated to use `Label` from `radix-ui`
  - `progress.tsx`: Updated to use `Progress` from `radix-ui`
  - `select.tsx`: Updated to use `Select` from `radix-ui` and migrated icons to Lucide
  - `sheet.tsx`: Updated to use `Sheet` from `radix-ui`
  - `tabs.tsx`: Updated to use `Tabs` from `radix-ui`
  - `tooltip.tsx`: Updated to use `Tooltip` from `radix-ui`

#### Icon migration
- **Replaced Radix icons**: Migrated from `@radix-ui/react-icons` to Lucide icons
- **Features component**: Replaced `MobileIcon` from Radix with `SmartphoneIcon` from Lucide
- **Select component**: Replaced `CheckIcon` from Radix with Lucide's `CheckIcon`
- Removed `@radix-ui/react-icons` dependency

#### Package updates
- **UI package**: Updated `packages/ui/package.json` to use unified `radix-ui` package
- **Web app**: Updated `apps/web/package.json` to use unified `radix-ui` package
- **Dependencies**: Reduced from 13 separate Radix packages to 1 unified package

**Benefits:**
- Simplified dependency management with single package
- Reduced bundle size and faster install times
- Consistent versioning across all Radix UI components
- Easier maintenance and updates

---

## 2026-02-05 v2.0.2

### AI Chat refactoring and UI improvements

#### AI Chat simplification
- **Major refactoring**: Simplified AI chat feature to streaming-only interface, removing chat persistence
- **Removed**: Chat storage and CRUD operations (create, list, find, update, delete, add-message procedures)
- **Removed**: `AiChat` database model from all schemas (Prisma, Drizzle MySQL/PostgreSQL/SQLite)
- **Removed**: Database queries for AI chats (`ai-chats.ts` files)
- **Simplified**: AI router now only exposes a single `stream` endpoint for real-time AI responses
- **Refactored**: `AiChat` component to use streaming without persistence, using `@ai-sdk/react`'s `useChat` hook
- **Simplified**: Chatbot pages removed prefetching logic for chat lists and individual chats
- **New**: `stream-message` procedure that streams AI responses without storing conversations

**Breaking changes:**
- Any code using `orpcClient.ai.chats.*` endpoints will need to be updated
- Database migrations will need to drop the `ai_chat` table if it exists
- Chat history persistence is no longer available - conversations are session-only

#### UI component improvements
- **NavBar**: Added conditional bottom border when scrolled (`border-b` when `!isTop`)
- **Button component**: Removed icon opacity styling (`[&>svg]:opacity-60`) for better icon visibility
- **Global styles**: Added consistent Lucide icon stroke-width (`1.75`) for improved icon rendering

---

## 2026-02-05 v2.0.1

### UI component enhancements and design improvements

#### Toast component redesign
- **Major enhancement**: Complete redesign of the toast component with custom styling and improved UX
- Added custom `Toast` component with support for different types (success, error, info, warning, loading, default)
- Added automatic icons for each toast type using Lucide icons
- Added helper functions: `toastSuccess`, `toastError`, `toastInfo`, `toastWarning`, `toastLoading`
- Added `toastPromise` function for handling async operations with loading/success/error states
- Improved visual design with type-specific border colors and icons
- Added support for action and cancel buttons in toasts
- All form components updated to use the new toast API

#### Color mode toggle redesign
- **Redesigned**: Changed from dropdown menu to a modern segmented control/toggle button style
- Added smooth sliding indicator animation for active state
- Replaced dropdown menu with inline toggle buttons for better UX
- Added tooltips for each color mode option (System, Light, Dark)
- Improved accessibility with proper ARIA labels and pressed states
- Added translations for color mode labels (`common.colorMode.system`, `common.colorMode.light`, `common.colorMode.dark`)
- Updated icon from `HardDriveIcon` to `MonitorCogIcon` for system mode

#### User menu improvements
- **Simplified**: Removed inline color mode selection submenu from user menu
- Color mode toggle now uses the standalone `ColorModeToggle` component
- Cleaner menu structure with better separation of concerns

#### Component styling updates
- **Select component**: Updated border radius from `rounded-md` to `rounded-lg` for consistency with design system
- **SettingsItem component**: Increased left column width from `280px` to `320px` for better content spacing
- **Theme colors**: Updated muted background color from `#1d1e1e` to `#191b1b` for improved contrast

#### Form components
- Updated all SaaS form components to use the new toast API:
  - Organization forms (Create, Change Name, Delete, Logo, Invite Member)
  - Settings forms (Change Email, Change Name, Change Password, Set Password, Delete Account, User Avatar, User Language)
  - Admin components (Organization Form, Organization List, User List)
  - Organization management components (Members List, Invitations List, Organization Select)
  - Security components (Passkeys Block, Two Factor Block, Active Sessions Block)
  - Customer Portal Button

---

## 2026-02-02 v2.0.0

### Major architectural changes and breaking updates

This release introduces significant architectural changes that require migration steps. The major version bump reflects multiple breaking changes across the codebase. All existing code has been updated to use the new structure, but custom code will need manual migration.

#### Summary of breaking changes

- **Docs application**: Moved from web app to standalone Next.js app (`apps/docs`)
- **UI components**: Moved from `apps/web/modules/ui/` to `packages/ui/`
- **Configuration**: Removed centralized `config/` package, now scoped to individual packages
- **Shared components**: Moved `Logo` and `Spinner` components to `@repo/ui`
- **Mail package**: Restructured directory layout (removed `src/`), removed Logo component and custom provider
- **Payments package**: Moved helper utilities from `src/lib/` to `lib/`
- **Mail preview app**: New `apps/mail-preview` application added for email previewing
- **Not-found pages**: New dedicated not-found pages for marketing and SaaS routes
- **Import paths**: All imports updated throughout codebase (275+ files changed)

#### Dedicated docs application

Documentation has been moved from the web app to a standalone Next.js application using fumadocs.

**Breaking changes:**
- Removed docs routes from `apps/web/app/(marketing)/[locale]/docs/[[...path]]/`
- Removed docs API route `apps/web/app/api/docs-search/route.ts`
- Removed `apps/web/app/docs-source.ts`
- Removed all docs content from `apps/web/content/docs/` (including `getting-started/` and `index.mdx`)
- Removed `TableOfContents` component from marketing shared components
- Removed docs image from `apps/web/public/images/docs/login.png`
- Updated `apps/web/content-collections.ts` to exclude docs content
- Updated `apps/web/app/sitemap.ts` to exclude docs routes

**New structure:**
- Created new `apps/docs` application using fumadocs
- Docs now run as a separate Next.js app (default port 3001)
- Docs content moved to `apps/docs/content/docs/`
- Uses fumadocs-ui for improved documentation experience
- Includes AI-powered page actions component
- New docs app has its own `package.json`, `tsconfig.json`, and `next.config.ts`

**Migration steps:**
1. If you have custom docs content, migrate it to `apps/docs/content/docs/`
2. Update any links pointing to `/docs/*` routes - docs are now served from the separate app
3. Remove any imports of `TableOfContents` component
4. Run `pnpm dev` in the `apps/docs` directory to start the docs server (or use `pnpm --filter @repo/docs dev`)
5. Update any CI/CD pipelines that build or deploy docs

#### UI components moved to packages

All UI components have been moved from the web app to a shared package for better reusability across the monorepo.

**Breaking changes:**
- Removed all UI components from `apps/web/modules/ui/components/` (25+ components including accordion, alert, button, card, dialog, form, input, select, etc.)
- Removed `apps/web/modules/ui/lib/index.ts`
- Removed `apps/web/components.json` (shadcn config file)
- All component imports throughout the codebase have been updated

**New structure:**
- Created `packages/ui` package containing all UI components
- Components now imported from `@repo/ui/components/[component-name]`
- Shared utilities (like `cn`) available from `@repo/ui`
- `components.json` moved to `packages/ui/components.json`
- Package includes all Radix UI dependencies and styling utilities

**Migration steps:**
1. Update all imports from `apps/web/modules/ui/components/*` to `@repo/ui/components/*`
2. Update imports of `cn` utility from `apps/web/modules/ui` to `@repo/ui`
3. Remove any references to `components.json` in the web app
4. Install `@repo/ui` as a dependency if using UI components in other packages
5. Update TypeScript path aliases if you had custom ones pointing to the old location

#### Configuration restructuring

The centralized config package has been removed in favor of scoped configuration files for better package isolation.

**Breaking changes:**
- Removed `config/` package entirely:
  - `config/index.ts`
  - `config/package.json`
  - `config/tsconfig.json`
  - `config/types.ts`
- All imports from `@repo/config` or `config` will fail
- Config is now scoped to individual packages

**New structure:**
- Each package now has its own `config.ts` file:
  - `apps/web/config.ts` - Web app configuration
  - `packages/api/config.ts` - API configuration
  - `packages/auth/config.ts` - Auth configuration
  - `packages/i18n/config.ts` - i18n configuration
  - `packages/mail/config.ts` - Mail configuration
  - `packages/payments/config.ts` - Payments configuration
  - `packages/storage/config.ts` - Storage configuration
- Root `config.ts` file for shared configuration

**Migration steps:**
1. Update imports from `@repo/config` or `config` to package-specific configs:
   - `import { config } from "@/config"` for web app
   - `import { config as i18nConfig } from "@repo/i18n/config"` for package configs
2. Update any code referencing the old config package structure
3. Review each package's config file to understand what configuration is available
4. Update environment variable usage if config structure changed

#### Shared components cleanup

Removed unused shared components that are now available in the UI package.

**Breaking changes:**
- Removed `apps/web/modules/shared/components/Logo.tsx`
- Removed `apps/web/modules/shared/components/Spinner.tsx`
- All imports of these components throughout the codebase have been updated

**Migration steps:**
1. Replace any imports of `Logo` from `@shared/components/Logo` - Logo is now available from `@repo/ui`
2. Replace any imports of `Spinner` - use skeleton components from `@repo/ui` instead
3. Update any custom code that imports these components

#### Mail package restructuring

Mail package has been restructured with a flatter directory structure and improved organization.

**Breaking changes:**
- Removed `packages/mail/src/components/Logo.tsx` (use `@repo/ui` instead)
- Removed `packages/mail/src/provider/custom.ts` provider
- Restructured mail package directory layout:
  - `src/components/` → `components/` (PrimaryButton, Wrapper moved)
  - `src/provider/` → `provider/` (all providers moved)
  - `src/util/` → `util/` (send, templates, translations moved)
- Updated all mail provider implementations to use new config structure
- Updated all mail email templates to use new import paths

**New structure:**
- Flatter directory structure without `src/` directory
- Components, providers, and utilities at package root level
- New `packages/mail/config.ts` for mail configuration
- New `apps/mail-preview` application for email previewing (runs on port 3005)

**Migration steps:**
1. If using the Logo component in mail templates, import from `@repo/ui` instead:
   ```typescript
   import { Logo } from "@repo/ui";
   ```
2. If using custom mail provider, migrate to one of the supported providers:
   - Resend
   - Nodemailer
   - Mailgun
   - Postmark
   - Plunk
   - Console (for development)
3. Update mail provider configuration to use `packages/mail/config.ts`
4. Update any imports from `packages/mail/src/*` to `packages/mail/*`
5. Use `apps/mail-preview` app for previewing emails during development

#### Payments package restructuring

Payments package has been restructured with helper utilities moved to a new location.

**Breaking changes:**
- Moved `packages/payments/src/lib/customer.ts` → `packages/payments/lib/customer.ts`
- Moved `packages/payments/src/lib/helper.ts` → `packages/payments/lib/helper.ts` (new location)
- Removed old `packages/payments/src/lib/helper.ts` (duplicate removed)
- Updated payment provider implementations (Stripe, LemonSqueezy, DodoPayments, Polar)
- Updated payment procedures to use new config structure

**New structure:**
- Helper utilities now in `packages/payments/lib/` (without `src/` prefix)
- New `packages/payments/config.ts` for payment configuration

**Migration steps:**
1. Update imports from `packages/payments/src/lib/*` to `packages/payments/lib/*`
2. Update payment configuration to use `packages/payments/config.ts`
3. Review `packages/payments/lib/` directory for helper functions

#### Import path updates

All components and modules have been updated to use the new import paths throughout the entire codebase.

**Affected areas:**
- UI component imports across all modules (200+ files updated)
- Config imports throughout the codebase
- Shared component imports
- Mail template imports
- Payment provider imports

**Migration steps:**
1. Run `pnpm install` to ensure all workspace dependencies are linked correctly
2. Update any custom code using old import paths:
   - `apps/web/modules/ui/*` → `@repo/ui/*`
   - `@repo/config` → package-specific configs
   - `@shared/components/Logo` → `@repo/ui`
3. Run type checking: `pnpm type-check` to identify any remaining import issues
4. Update any custom scripts or build tools that reference old paths

#### Workspace configuration updates

The workspace structure has been updated to reflect the new package organization.

**Breaking changes:**
- `pnpm-workspace.yaml` still references `config` package (which was removed) - this should be updated manually
- Workspace now includes new `apps/docs` application
- Workspace includes new `packages/ui` package

**Migration steps:**
1. Update `pnpm-workspace.yaml` to remove the `config` entry:
   ```yaml
   packages:
     - apps/*
     - packages/*
     - tooling/*
   ```
2. Run `pnpm install` to refresh workspace links
3. Verify all packages are properly linked with `pnpm list --depth=0`

#### Biome configuration standardization

All Biome configurations have been standardized across the monorepo for consistency.

**Changes:**
- Updated all Biome configurations across packages to use consistent settings
- Standardized Biome config format: all package-level configs now extend root config with `"extends": "//"`
- Root `biome.json` contains shared configuration
- Package-specific `biome.json` files only override when needed
- Database package excludes Prisma-generated zod files from linting

**Migration steps:**
1. If you have custom Biome rules, ensure they follow the new pattern:
   ```json
   {
     "root": false,
     "extends": "//"
   }
   ```
2. Run `pnpm format` to apply new formatting rules
3. Run `pnpm lint` to check for any linting issues with new config

#### Package dependencies and workspace structure

Package dependencies have been updated to reflect the new architecture.

**Changes:**
- Added `@repo/ui` as a workspace dependency where needed
- Updated `pnpm-lock.yaml` with new workspace structure (2760+ lines changed)
- Removed dependencies on deleted `config` package
- Updated all package `package.json` files to reflect new structure
- Added `@repo/docs` workspace package
- Updated tooling packages (scripts, tailwind, typescript) with new dependencies
- Updated i18n translations (en.json, de.json) with new messages

**Migration steps:**
1. Run `pnpm install` to ensure all workspace dependencies are linked correctly
2. Verify workspace structure with `pnpm list --depth=0`
3. Check for any remaining references to `@repo/config` in `package.json` files

#### Monorepo organization improvements

The monorepo structure has been improved for better organization and maintainability.

**Changes:**
- Improved package boundaries and separation of concerns
- Better isolation between apps and packages
- Clearer dependency relationships
- New `apps/docs` application added to workspace
- New `apps/mail-preview` application added to workspace
- New `packages/ui` package for shared UI components
- Removed `config/` package in favor of scoped configs
- Flattened directory structures in mail and payments packages (removed `src/` directories)

**Benefits:**
- Better code organization and discoverability
- Clearer separation between application code and shared packages
- Easier to understand dependencies between packages
- Better support for independent package versioning

#### Other updates

**Documentation:**
- Updated `agents.md` to reflect new architecture and import paths
- Updated coding guidelines to reference new package structure
- Updated import examples to use new `@repo/ui` package

**Configuration:**
- Updated `.env.local.example` with new configuration structure
- Updated environment variable documentation

**Build and deployment:**
- Updated sitemap generation to exclude docs routes
- Updated content collections configuration to exclude docs
- Updated image proxy route configuration
- Updated `turbo.json` to use TUI interface (`"ui": "tui"`)

**New applications:**
- Added `apps/docs` - Standalone documentation application using fumadocs
- Added `apps/mail-preview` - Email preview application for development (port 3005)

**Not-found pages:**
- Added dedicated `not-found.tsx` pages for marketing routes (`apps/web/app/(marketing)/[locale]/not-found.tsx`)
- Added dedicated `not-found.tsx` pages for SaaS routes (`apps/web/app/(saas)/app/not-found.tsx`)
- Removed `NotFound` component from marketing shared components (now using Next.js not-found pages)

**TypeScript:**
- Updated TypeScript configurations across packages
- Updated path aliases in `tsconfig.json` files
- Added new type definitions for UI package exports
- Added TypeScript configs for new apps (docs, mail-preview)

---

## 2026-01-30 v1.3.5

### Design system updates and UI improvements

#### Visual design updates
- Updated color scheme: replaced `bg-card` with `bg-background` in navigation and app wrapper for better contrast
- Changed newsletter section background from `bg-primary/5` to `bg-muted` for consistency
- Removed borders from card components and dropdown menus for a cleaner look
- Updated button styles: changed from `rounded-md` to `rounded-full` for a more modern appearance
- Increased container max-width from `--container-6xl` to `--container-7xl` for better use of screen space

#### Typography improvements
- Increased heading sizes across marketing pages (Hero, Features sections)
- Adjusted letter spacing from `-0.02em` to `-0.01em` for improved readability
- Added max-width constraint to hero paragraph for better text flow

#### Component enhancements
- Enhanced changelog component: added title field to changelog items with improved layout
- Updated changelog section styling: switched to `rounded-3xl` with `bg-muted` background
- Improved dropdown menu styling: updated border radius and shadow for better visual hierarchy
- Updated settings item component: removed explicit border and rounded corners for cleaner appearance

---
## 2026-01-26 v1.3.4

### Enhanced organization dashboard with visual trend charts

The organization dashboard now includes interactive trend charts to make the UI more visual.

---

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
