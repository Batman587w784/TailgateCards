This file provides guidance to Claude Code when working with code in this repository.

## Core Technologies

- **Next.js 16** with App Router
- **Supabase** for database, auth, and storage
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**, Shadcn UI, Lucide React
- **Turborepo**

## Monorepo Structure

- `apps/web` - Main Next.js SaaS application
- `apps/web/supabase` - Supabase folder (migrations, schemas, tests)
- `apps/e2e` - Playwright end-to-end tests
- `packages/features/*` - Feature packages
- `packages/` - Shared packages and utilities

## Platform: Tailgate

This codebase powers **Tailgate**, an NFC discount-card platform. It descends from Makerkit but the multi-tenant model has been replaced with a role-based one.

### Roles

| Role | Source | Purpose |
|------|--------|---------|
| `super-admin` | JWT `app_metadata.role` + AAL2 (MFA) | Platform administration |
| `org_admin` | `accounts_memberships.account_role` | Manages an organization, its distributors and cards |
| `distributor` | `accounts_memberships.account_role` | Sells cards on behalf of an org |
| `merchant` | `accounts_memberships.account_role` | Validates redemptions, runs analytics |
| `cardholder` | Default for any authenticated user | Holds NFC cards, browses/redeems discounts |

The current user's role is derived via the `get_user_platform_role()` RPC. Per-role profiles live in `organization_profiles`, `merchant_profiles`, and `cardholder_profiles` (each keyed by `accounts.id`). Page/data/role mapping is documented in `apps/web/RBAC.md`.

Role gating uses `apps/web/app/dashboard/(user)/_lib/server/role-guards.ts` — `requireOrgAdmin()` / `requireMerchant()` / etc. for pages, and `orgAdminAction()` / `merchantAction()` / etc. for mutations. The Makerkit "personal vs team account" abstraction is still partially scaffolded under `dashboard/[account]/` (members, settings, billing) but the active app is the role-aware `dashboard/(user)/` tree.

## Essential Commands

### Development Workflow

```bash
pnpm dev                    # Start all apps
```

### Database Operations

```bash
pnpm supabase:web:start     # Start Supabase locally
pnpm --filter web supabase migrations up     # Apply new migrations
pnpm supabase:web:reset     # Reset with latest schema (clean rebuild)
pnpm supabase:web:typegen   # Generate TypeScript types
pnpm --filter web supabase:db:diff  # Create migration
```

The typegen command must be run after applying migrations or resetting the database.

## Typescript

- Write clean, clear, well-designed, explicit TypeScript
- Avoid obvious comments
- Avoid unnecessary complexity or overly abstract code
- Always use implicit type inference, unless impossible
- You must avoid using `any`
- Handle errors gracefully using try/catch and appropriate error types
- Use service pattern for server-side APIs
- Add `import 'server-only';` to code that is exclusively server-side
- Never mix client and server imports from a file or a package
- Extract self-contained classes/utilities (ex. algortihmic code) from classes that cross the network boundary

## React

- Encapsulate repeated blocks of code into reusable local components
- Write small, composable, explicit, well-named components
- Always use `react-hook-form` and `@kit/ui/form` for writing forms
- Always use 'use client' directive for client components
- Add `data-test` for E2E tests where appropriate
- `useEffect` is a code smell and must be justified - avoid if possible
- Do not write many (such as 4-5) separate `useState`, prefer single state object (unless required)
- Prefer server-side data fetching using RSC
- Display loading indicators (ex. with LoadingSpinner) component where appropriate

## Next.js

- Use `enhanceAction` for Server Actions
- Use `use server` in server actions files
- Use `enhanceRouteHandler` for API Routes
- Export page components using the `withI18n` utility
- Add well-written page metadata to pages
- Redirect using `redirect` following a server action instead of using client-side router
- Since `redirect` throws an error, handle `catch` block using `isRedirectError` from `next/dist/client/components/redirect-error` in client-side forms when calling the server action


## Data Fetching Architecture

Makerkit uses a clear separation between data fetching and mutations:

### Server Components with Loaders (Reading Data)

**Pattern**: async server components call loader functions co-located in `_lib/server/`. Loaders parallelise fetches with `Promise.all`.

```typescript
// apps/web/app/dashboard/(user)/org-admin/cards/page.tsx
import { requireOrgAdmin } from '../../_lib/server/role-guards';
import { loadOrgAdminCardsPage } from './_lib/server/cards-page.loader';

async function CardsPage() {
  await requireOrgAdmin();

  const client = getSupabaseServerClient();
  const [stats, batches] = await loadOrgAdminCardsPage(client);

  return <CardsList stats={stats} batches={batches} />;
}

// apps/web/app/dashboard/(user)/org-admin/cards/_lib/server/cards-page.loader.ts
import 'server-only';

export async function loadOrgAdminCardsPage(client: SupabaseClient<Database>) {
  const orgId = await getUserOrganizationId();

  return Promise.all([
    client.rpc('get_org_admin_card_stats', { org_id: orgId }),
    client.rpc('get_org_admin_cards_distribution', { org_id: orgId }),
  ]);
}
```

### Server Actions (Mutations Only)

**Pattern**: `enhanceAction` for create/update/delete with schema validation, wrapped in a role-action helper when role gating is required.

```typescript
// _lib/server/cards-server-actions.ts
'use server';

import { enhanceAction } from '@kit/next/actions';
import { orgAdminAction } from '../../../_lib/server/role-guards';

export const createCardBatch = orgAdminAction(
  enhanceAction(
    async (data) => {
      const client = getSupabaseServerClient();
      // ...
      return { success: true };
    },
    { schema: CreateCardBatchSchema },
  ),
);
```

### Authorization & RLS

- **Server Components**: RLS automatically enforces data access control. Role gating for *page access* uses `requireXxx()` from `dashboard/(user)/_lib/server/role-guards.ts`.
- **Server Actions**: RLS validates data permissions; role-action wrappers (`orgAdminAction`, `merchantAction`, etc.) gate the action itself.
- **No manual auth checks needed** when using the standard Supabase client.
- **Admin client**: only for bypassing RLS (rare; requires careful manual validation of both authentication and authorization).

## File Organization Patterns

### Route Structure

```
apps/web/app/dashboard/(user)/
├── page.tsx                  # Multi-role dispatcher — renders per-role dashboard
├── layout.tsx                # Sidebar/header shell, role-aware navigation
├── org-admin/                # Routes guarded by requireOrgAdmin()
│   ├── cards/
│   │   ├── page.tsx
│   │   └── _lib/server/
│   │       ├── cards-page.loader.ts
│   │       └── cards-server-actions.ts
│   └── distributors/
│       ├── page.tsx
│       └── _lib/server/
├── merchant/                 # Routes guarded by requireMerchant()
│   └── visitor-insights/
├── entities/, discounts/, payments/, accounts/, cards/, sales/  # Cross-role pages
├── settings/, account-settings/, billing/                        # Per-user settings
├── _components/              # Role-scoped UI: org-admin/, merchant/, distributor/, cardholder/
│   ├── org-admin-navigation.tsx
│   ├── merchant-navigation.tsx
│   ├── distributor-navigation.tsx
│   ├── admin-navigation.tsx
│   └── home-sidebar.tsx
└── _lib/server/
    ├── role-guards.ts                       # Role checks, page guards, action wrappers
    ├── load-user-workspace.ts
    ├── org-admin-dashboard.loader.ts
    ├── distributor-dashboard.loader.ts
    ├── merchant-page.loader.ts
    ├── cardholder-page.loader.ts
    └── super-admin-dashboard.loader.ts
```

The `dashboard/[account]/` tree (members, settings, billing) is the legacy team-account context kept from Makerkit; new role-aware features belong under `dashboard/(user)/`.

### Naming Conventions
- **Pages**: `page.tsx` (Next.js convention)
- **Loaders**: `{feature}-page.loader.ts`
- **Actions**: `{feature}-server-actions.ts`
- **Schemas**: `{feature}.schema.ts`
- **Components**: `kebab-case.tsx`

## UI Components

UI Components are placed at `packages/ui`. Call MCP tool to list components to verify they exist.

## Delegate to Agents

Please use the Task tool to delegate suitable tasks to specialized sub-agents for best handling the task at hand.

## Verification Steps

After implementation:
1. **Run `pnpm typecheck`** - Must pass without errors
2. **Run `pnpm lint:fix`** - Auto-fix issues
3. **Run `pnpm format:fix`** - Format code