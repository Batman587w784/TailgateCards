# Web Application Instructions

This file contains instructions specific to the main Next.js web application — the **Tailgate** platform, an NFC discount-card system. The codebase is built on top of Makerkit, but several Makerkit primitives ("personal vs team accounts", workspace hooks, etc.) have been replaced or repurposed for Tailgate's role-based model. See `apps/web/RBAC.md` for the authoritative role/page/model mapping.

## Application Structure

### Route Organization

```
app/
├── (marketing)/          # Public pages: landing, blog, docs, faq, pricing, changelog, legal
├── (standalone)/         # Standalone pages outside the marketing layout (e.g. /contact)
├── auth/                 # Sign-in, sign-up, callback, password reset, MFA verify, confirm
├── dashboard/
│   ├── (user)/           # Authenticated app — role-aware multi-role dispatcher
│   └── [account]/        # Legacy team-account context (members, settings, billing); `[account]` = team slug
├── activate/             # Cardholder NFC activation flow (`/activate` manual entry + `/activate/[code]` for QR/scan)
├── validate/             # Merchant card-validation & discount-redemption flow
├── identities/           # Post-auth identity-linking screen
├── join/                 # Team invitation acceptance + `setup-password`
├── admin/                # Reserved for super-admin pages (middleware-gated)
└── api/                  # Route handlers: billing, cards, db, organizations (each with webhooks)
```

Key facts:

- `dashboard/(user)/page.tsx` is a **multi-role dispatcher** — it renders a different dashboard component per role (super-admin, org_admin, distributor, merchant, cardholder).
- Role-scoped subtrees live under `dashboard/(user)/`: `org-admin/cards`, `org-admin/distributors`, `merchant/visitor-insights`, etc. Each page calls a `requireXxx()` role guard at the top.
- `apps/web/proxy.ts` (not `middleware.ts`) is the Next.js edge middleware — it handles CSRF, secure headers, request-id correlation, auth-gating for `/dashboard/*`, super-admin gating + MFA enforcement for `/admin/*`, and the `/auth/verify` MFA redirect flow.
- The `[account]` parameter is the `accounts.slug` property, not the ID.

### Component Organization

- **Route-specific components**: `_components/` (often nested by role: `_components/org-admin/`, `_components/merchant/`, etc.)
- **Server-side utilities (loaders, actions, services, guards)**: `_lib/server/`
- **Client-side utilities (schemas, hooks)**: `_lib/`
- **App-wide components**: `apps/web/components/`

Examples:
- Role guards: `app/dashboard/(user)/_lib/server/role-guards.ts`
- Org-admin pages: `app/dashboard/(user)/org-admin/{cards,distributors}/page.tsx`
- Merchant page: `app/dashboard/(user)/merchant/visitor-insights/page.tsx`
- Loaders: `app/dashboard/(user)/_lib/server/{org-admin-dashboard,distributor-dashboard,merchant-page,cardholder-page,super-admin-dashboard,visitor-insights}.loader.ts`

## Platform Roles & Authorization

There are **4 platform roles** plus **1 special admin role**. Full mapping (page → tables → guards) lives in `apps/web/RBAC.md`.

| Role | Source | Purpose |
|------|--------|---------|
| `super-admin` | JWT `app_metadata.role = 'super-admin'` + AAL2 (MFA) | Platform administration |
| `org_admin` | `accounts_memberships.account_role` | Manages an organization, its distributors, cards |
| `distributor` | `accounts_memberships.account_role` | Sells cards on behalf of an org |
| `merchant` | `accounts_memberships.account_role` | Validates redemptions, runs analytics |
| `cardholder` | Default for any authenticated user (no membership row required) | Holds NFC cards, browses/redeems discounts |

Platform role for the current user is derived via the `get_user_platform_role()` RPC.

### Role Guards

All role gating uses helpers from `app/dashboard/(user)/_lib/server/role-guards.ts`:

```typescript
import {
  // Boolean checks
  isOrgAdmin, isDistributor, isMerchant, isCardholder,
  hasPlatformRole, getPlatformRole,
  // Page guards (return 404 on failure)
  requireOrgAdmin, requireDistributor, requireMerchant, requireCardholder, requireAnyRole,
  // Server-action wrappers
  roleAction, orgAdminAction, distributorAction, merchantAction,
  // Scoped-id helpers
  getUserOrganizationId, getUserMerchantId,
} from '../_lib/server/role-guards';

// Page guard
export default async function CardsPage() {
  await requireOrgAdmin();
  // ...
}

// Server-action guard
export const addDistributor = orgAdminAction(
  enhanceAction(async (data) => { /* ... */ }, { schema: AddDistributorSchema }),
);
```

### Profile Tables

Each non-cardholder role has a profile row keyed by `accounts.id`:
- `organization_profiles` — for `org_admin` accounts (`organization_name`, `cash_payments_enabled`, ...)
- `merchant_profiles` — for `merchant` accounts (`business_name`, `dashboard_passcode_hash`, ...)
- `cardholder_profiles` — for `cardholder` accounts (`stripe_customer_id`, ...)

## React Server Components — Async Pattern

In Next.js 16, always await `params` directly in async server components:

```typescript
// WRONG — don't use React.use() in async functions
async function Page({ params }: Props) {
  const { account } = use(params);
}

// CORRECT — await params directly in Next.js 16
async function Page({ params }: Props) {
  const { account } = await params;
}

// CORRECT — `use` only in non-async functions
function Page({ params }: Props) {
  const { account } = use(params);
}
```

## Data Fetching Strategy

**Decision framework:**

- **Server Components** — default for initial data load.
- **Client Components** — for interactive features needing hooks or realtime updates.
- **Admin Client** — only to bypass RLS (rare; requires manual auth+authorization).

### Server Components (preferred)

```typescript
import { getSupabaseServerClient } from '@kit/supabase/server-client';

async function Page() {
  const client = getSupabaseServerClient();
  const { data, error } = await client.from('cards').select('*');
  if (error) return <ErrorMessage error={error} />;
  return <CardsList cards={data} />;
}
```

RLS is automatically applied — no manual auth checks needed when using the standard server client.

### Loader Pattern

Loaders live next to the page in `_lib/server/` and parallelise data fetches:

```typescript
// app/dashboard/(user)/_lib/server/org-admin-dashboard.loader.ts
import 'server-only';

export async function loadOrgAdminDashboard(client: SupabaseClient<Database>) {
  const orgId = await getUserOrganizationId();

  return Promise.all([
    client.rpc('get_org_admin_card_stats', { org_id: orgId }),
    client.rpc('get_org_admin_revenue_stats', { org_id: orgId }),
    client.rpc('get_org_admin_top_distributors', { org_id: orgId }),
    // ...
  ]);
}
```

Tailgate is heavily RPC-driven. Common RPC name patterns: `get_org_admin_*`, `get_distributor_*`, `get_merchant_*`, `get_cardholder_*`, `get_admin_*`, plus role utilities (`get_platform_role`, `has_platform_role`, `verify_merchant_passcode`).

### Server Actions (mutations only)

```typescript
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

### Client Components (interactive)

```typescript
'use client';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useQuery } from '@tanstack/react-query';

function LiveStats() {
  const supabase = useSupabase();
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => supabase.from('redemptions').select('*'),
  });
  if (isLoading) return <Spinner />;
  return <Stats rows={data} />;
}
```

### Parallel Data Fetching

Always parallelise independent fetches with `Promise.all` — this is the established convention across all loaders.

## Authorization Patterns

### RLS-protected fetches (standard)

```typescript
const client = getSupabaseServerClient();
// RLS enforces access — no extra auth checks required
const { data } = await client.from('cards').select('*');
```

### Page-level role gating

```typescript
import { requireOrgAdmin } from '../_lib/server/role-guards';

export default async function Page() {
  await requireOrgAdmin();
  // ...
}
```

### Admin client (use sparingly)

```typescript
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

async function adminTask(targetUserId: string) {
  const client = getSupabaseServerClient();
  if (!(await isSuperAdmin(client))) {
    throw new Error('Unauthorized');
  }

  const admin = getSupabaseServerAdminClient();
  // RLS bypassed — every constraint must be enforced manually
  return admin.from('cards').select('*').eq('cardholder_id', targetUserId);
}
```

Rule of thumb: standard client → trust RLS. Admin client → validate everything by hand.

## Workspace Context (legacy)

`UserWorkspaceContextProvider` and `TeamAccountWorkspaceContextProvider` from `@kit/accounts` and `@kit/team-accounts` are still wired into `dashboard/(user)/layout.tsx` and `dashboard/[account]/layout.tsx` — but the `useUserWorkspace` / `useTeamAccountWorkspace` hooks are **not consumed** anywhere in the app code. Role-aware UI uses `role-guards.ts` and direct loaders instead. Treat these contexts as Makerkit scaffolding rather than the active mechanism for role/account data.

## Internationalization

Always use `Trans` from `@kit/ui/trans`:

```tsx
import { Trans } from '@kit/ui/trans';

<Trans i18nKey="user:welcomeMessage" values={{ name: user.name }} />

<Trans
  i18nKey="terms:agreement"
  components={{ TermsLink: <a href="/terms" className="underline" /> }}
/>
```

### Default namespaces

Configured in `apps/web/lib/i18n/i18n.settings.ts`: `common`, `auth`, `account`, `teams`, `billing`, `marketing`, `merchant`.

### Adding a language

1. Add the code to `lib/i18n/i18n.settings.ts`.
2. Create translation files under `public/locales/<locale>/`.
3. Mirror the structure of the English files.

### Adding a namespace

1. Add JSON files at `public/locales/<locale>/<namespace>.json`.
2. Register the name in `defaultI18nNamespaces` in `lib/i18n/i18n.settings.ts`.

## Key Configuration Files

- App: `config/app.config.ts`
- Auth providers / reCAPTCHA: `config/auth.config.ts`
- Billing (Stripe): `config/billing.config.ts`
- Paths: `config/paths.config.ts`
- Feature flags: `config/feature-flags.config.ts`
- Personal nav (style/sidebar defaults for `dashboard/(user)`): `config/personal-account-navigation.config.tsx`
- Team nav (sidebar for `dashboard/[account]`): `config/team-account-navigation.config.tsx`
- i18n: `lib/i18n/i18n.settings.ts`
- Edge middleware: `proxy.ts`
- Supabase: `supabase/config.toml`

## Route Handlers (API)

Use `enhanceRouteHandler` from `@kit/next/routes`:

```typescript
import { enhanceRouteHandler } from '@kit/next/routes';

export const POST = enhanceRouteHandler(
  async function ({ body, user, request }) {
    return NextResponse.json({ success: true });
  },
  { auth: true, schema: ZodSchema },
);
```

Existing API surface lives under `app/api/{billing,cards,db,organizations}` with webhook routes for each.

## Navigation Menus

The `dashboard/(user)` sidebar/header is composed at runtime from role-specific React components in `app/dashboard/(user)/_components/` rather than from a single config object:

- `home-sidebar.tsx` / `home-menu-navigation.tsx` — outer shells; pick which role-specific nav to render.
- `org-admin-navigation.tsx`, `merchant-navigation.tsx`, `distributor-navigation.tsx`, `admin-navigation.tsx` — per-role link sets.
- `home-mobile-navigation.tsx` — mobile menu.

`config/personal-account-navigation.config.tsx` only supplies layout style + default sidebar-collapsed state for this layout — its `routes` array is **not** the source of truth for links.

The team-account layout under `dashboard/[account]/` still uses `config/team-account-navigation.config.tsx` for its sidebar (members, settings, billing).

To add a sidebar item for a role:
1. Edit the appropriate `<role>-navigation.tsx` component.
2. Register a path in `config/paths.config.ts` under `app:` if it'll be referenced from elsewhere.
3. Add translations under `public/locales/<locale>/common.json` (or the relevant namespace).

## Cardholder & Merchant Flows

- `app/activate/page.tsx` — manual code entry by a cardholder.
- `app/activate/[code]/page.tsx` — NFC/QR-scanned card; renders the 3-step `ActivateCardFlow` (verify → activate → profile completion). Uses `stripe-card-checkout.service.ts` for paid flows.
- `app/validate/page.tsx` — authenticated merchant scans a card code, validates it, and applies a discount via `card-validation.actions`.
- `app/identities/page.tsx` — post-signup screen for linking auth providers.

## Security Guidelines

- **Authentication**: enforced by `apps/web/proxy.ts`. `/dashboard/*` redirects unauthenticated users to `/auth/sign-in`; `/admin/*` requires super-admin + MFA.
- **Authorization**: RLS at the DB layer for data access; `requireXxx()` guards for page access; `roleAction` / `orgAdminAction` / `distributorAction` / `merchantAction` for mutations.
- **Admin client**: only when bypassing RLS is unavoidable — every check must be re-implemented manually.
- **Sensitive data**: never pass to the client. Server env vars must not be exposed unless prefixed `NEXT_PUBLIC_*`.
- Validate every user input with a Zod schema (`enhanceAction({ schema })`, `enhanceRouteHandler({ schema })`).

## DB workflow (test/prod)

**Browsing.** Three Supabase MCP servers are registered (read-only): `supabase-local`, `supabase-test`, `supabase-prod`. Use them to inspect schemas, migrations, and rows on remote envs without dashboard navigation.

**CLI.** Use `./scripts/sb <env> <args...>` from `apps/web/` for all remote ops (`migration list`, `db push`, `db dump`, etc.). Bare `supabase ...` from `apps/web/` for local Docker. `pnpm supabase:web:typegen` is the one wrapper worth keeping — it composes two output paths.

**Incident flow.** Three skills cover the loop end-to-end:
- `triaging-db-issue` — read-only investigation when a report lands.
- `fixing-db-issue` — branch + declarative-first migration + local repro.
- `promoting-db-fix` — `./scripts/sb test db push` after merge to `testing`; prints (does not run) the prod push command.
