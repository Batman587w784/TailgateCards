# Role-Based Access Control (RBAC) Documentation

This document describes the RBAC system for the Tailgate platform, including role definitions, page access, and database model relationships.

## Platform Roles

The platform has **5 platform roles** and **1 special admin role**:

| Role | Description | Hierarchy Level |
|------|-------------|-----------------|
| **Super Admin** | Platform administrator (JWT-based, requires MFA) | Special |
| **district_admin** | Campus/District admin, above org_admin (M1/T2) | 0 (highest) |
| **org_admin** | Organization administrator | 1 |
| **distributor** | Sells cards on behalf of organization | 2 |
| **merchant** | Validates discounts, views analytics | 3 |
| **cardholder** | Default role for NFC card holders | 4 (lowest) |

### Role Derivation

- **Super Admin**: Stored in JWT `app_metadata.role = 'super-admin'` + requires AAL2 (MFA)
- **district_admin**: Derived from a `district_memberships` row (scoped to one district), ranked above all org roles by `get_user_platform_role()`. **Not** a `public.roles` row — the roles table requires `hierarchy_level > 0`, and district admins are not scoped to an *account*. Assignment is super-admin only.
- **Platform Roles**: Derived from `accounts_memberships.account_role` via `get_user_platform_role()` RPC

## Role → Page → Model Mappings

### Super Admin

**Access**: All pages + admin-specific pages

| Page | Route | Models (Tables) |
|------|-------|-----------------|
| Dashboard | `/dashboard` | All aggregated stats via admin RPCs |
| Entities | `/dashboard/entities` | `accounts`, `organization_profiles`, `merchant_profiles`, `cardholder_profiles` |
| Discounts | `/dashboard/discounts` | `discounts`, `merchant_profiles` |
| Payments | `/dashboard/payments` | `cards`, Stripe transactions |
| Accounts | `/dashboard/accounts` | `accounts`, `accounts_memberships` |

**Guard**: Use `isSuperAdmin()` from `@kit/admin`

```typescript
import { isSuperAdmin } from '@kit/admin';

export default async function AdminPage() {
  const client = getSupabaseServerClient();
  if (!(await isSuperAdmin(client))) {
    notFound();
  }
  // ... page content
}
```

---

### District Admin (`district_admin`) — M1/T2

**Access**: All organizations (chapters) + their distributors within the admin's
single district; district-wide leaderboards/analytics (T3). Assigned by
super-admin only.

| Page | Route | Models (Tables) |
|------|-------|-----------------|
| District dashboard | `/dashboard` (dispatch, T-later) | `districts`, `district_memberships`, `organization_profiles` (scoped by `district_id`) |
| Chapters / members | (T-later) | `organization_profiles`, `accounts_memberships` in-district |

**Scoping**: a `district_memberships (district_id, account_id)` row links the
admin's personal account to one district. Helper SQL:

- `public.is_district_admin_of(district_id)` — is the caller admin of that district?
- `public.get_user_district_id()` — the district the caller administers.
- `public.org_in_my_district(org_account_id)` — does that org belong to the caller's district?

Additive (permissive) RLS policies grant a district_admin `select` on their
district's `organization_profiles`, org `accounts`, and org `accounts_memberships`.

**Guard**: Use `requireDistrictAdmin()` from role-guards.

```typescript
import { requireDistrictAdmin, getUserDistrictId } from '../_lib/server/role-guards';

export default async function DistrictDashboardPage() {
  await requireDistrictAdmin();
  const districtId = await getUserDistrictId();
  // ... page content
}
```

**Server Action Wrapper**: `districtAdminAction(enhanceAction(...))`.

---

### Organization Admin (`org_admin`)

**Access**: Organization management, distributor management, analytics

| Page | Route | Models (Tables) |
|------|-------|-----------------|
| Dashboard | `/dashboard` | `organization_profiles`, `cards`, `accounts_memberships` |
| Distributors | `/dashboard/org-admin/distributors` | `accounts_memberships`, `accounts` (distributors) |
| Card Batches | `/dashboard/org-admin/card-batches` | `cards` (org's cards) |
| Analytics | `/dashboard/org-admin/analytics` | `cards`, `redemptions` (aggregated) |

**Guard**: Use `requireOrgAdmin()` from role-guards

```typescript
import { requireOrgAdmin } from '../_lib/server/role-guards';

export default async function DistributorsPage() {
  await requireOrgAdmin();
  // ... page content
}
```

**Server Action Wrapper**:

```typescript
import { orgAdminAction } from '../_lib/server/role-guards';

export const addDistributorAction = orgAdminAction(
  enhanceAction(async (data) => {
    // ... action logic
  }, { schema: AddDistributorSchema })
);
```

---

### Distributor (`distributor`)

**Access**: Card sales, cardholder registration, personal stats

| Page | Route | Models (Tables) |
|------|-------|-----------------|
| Dashboard | `/dashboard` | `cards` (assigned to this distributor) |
| Cards | `/dashboard/distributor/cards` | `cards` where `distributor_id = user` (full inventory; Active/Inactive filter) |
| Register Cardholder | `/dashboard/distributor/register` | `cards`, `cardholder_profiles` |

**Guard**: Use `requireDistributor()` from role-guards

```typescript
import { requireDistributor } from '../_lib/server/role-guards';

export default async function CardsPage() {
  await requireDistributor();
  // ... page content
}
```

**Key Data Access**:

```typescript
import { getUserOrganizationId } from '../_lib/server/role-guards';

const orgId = await getUserOrganizationId(); // Returns org they belong to
```

---

### Merchant (`merchant`)

**Access**: Discount validation, redemption history, analytics (passcode-protected)

| Page | Route | Models (Tables) |
|------|-------|-----------------|
| Dashboard | `/dashboard` | `merchant_profiles`, `discounts`, `redemptions` |
| Validate | `/dashboard/merchant/validate` | `cards`, `discounts`, `redemptions` |
| Redemptions | `/dashboard/merchant/redemptions` | `redemptions` where `merchant_id = user's merchant` |
| Analytics | `/dashboard/merchant/analytics` | `redemptions`, `discounts` (passcode-protected) |

**Guard**: Use `requireMerchant()` from role-guards

```typescript
import { requireMerchant } from '../_lib/server/role-guards';

export default async function ValidatePage() {
  await requireMerchant();
  // ... page content
}
```

**Analytics Passcode Protection**:

```typescript
// Verify passcode before showing analytics
const { data: isValid } = await client.rpc('verify_merchant_dashboard_passcode', {
  target_account_id: merchantAccountId,
  passcode: userInputPasscode,
});

if (!isValid) {
  return <PasscodeForm />;
}
return <AnalyticsDashboard />;
```

**Key Data Access**:

```typescript
import { getUserMerchantId } from '../_lib/server/role-guards';

const merchantId = await getUserMerchantId(); // Returns merchant account ID
```

---

### Cardholder (`cardholder`)

**Access**: Personal card info, discount browsing, redemption history

| Page | Route | Models (Tables) |
|------|-------|-----------------|
| Dashboard | `/dashboard` | `cards`, `cardholder_profiles` |
| Discounts | `/dashboard/discounts` (browse) | `discounts` (active, valid) |
| Card Info | Dashboard component | `cards` where `cardholder_id = user` |

**Note**: Cardholder is the default role. Most cardholder-specific data is loaded in the main dashboard via `loadCardholderDashboard()`.

---

## Database Schema Reference

### Core Tables

```
accounts
├── id (UUID, PK)
├── primary_owner_user_id → auth.users
├── is_personal_account (boolean)
├── organization_id → accounts (for distributors)
└── is_active (boolean)

accounts_memberships
├── user_id → auth.users
├── account_id → accounts
└── account_role → roles.name ('org_admin', 'distributor', 'merchant')
```

### Profile Tables

```
organization_profiles
├── account_id → accounts (unique)
├── organization_name
├── cash_payments_enabled
└── is_active

merchant_profiles
├── account_id → accounts (unique)
├── business_name
├── dashboard_passcode_hash
└── is_active

cardholder_profiles
├── account_id → accounts (unique)
└── stripe_customer_id
```

### Transaction Tables

```
cards
├── card_code (unique, format: TG-YYYY-XXXXXXX)
├── organization_id → accounts
├── distributor_id → accounts (nullable)
├── cardholder_id → accounts (nullable)
├── status ('pending', 'paid', 'activated', 'expired', 'cancelled')
└── payment_type ('stripe', 'cash')

discounts
├── merchant_id → accounts
├── title, description
├── discount_type ('percentage', 'fixed_amount')
├── discount_value
└── is_active

redemptions
├── card_id → cards
├── discount_id → discounts
├── merchant_id → accounts
├── validated_by → auth.users
└── status ('completed', 'refunded')
```

---

## Role Guards API Reference

### File Location

```
apps/web/app/dashboard/(user)/_lib/server/role-guards.ts
```

### Checking Roles

```typescript
import {
  isDistrictAdmin,
  isOrgAdmin,
  isDistributor,
  isMerchant,
  isCardholder,
  hasPlatformRole,
  getPlatformRole
} from '../_lib/server/role-guards';

// Check specific role
const isOrg = await isOrgAdmin(client);
const isDist = await isDistributor(client);
const isMerch = await isMerchant(client);

// Check any role
const hasRole = await hasPlatformRole(client, 'org_admin');

// Get current role
const role = await getPlatformRole(client); // Returns PlatformRole
```

### Requiring Roles (Page Guards)

```typescript
import {
  requireDistrictAdmin,
  requireOrgAdmin,
  requireDistributor,
  requireMerchant,
  requireCardholder,
  requireAnyRole
} from '../_lib/server/role-guards';

// In page.tsx - returns 404 if role check fails
await requireDistrictAdmin();
await requireOrgAdmin();
await requireDistributor();
await requireMerchant();
await requireAnyRole(['org_admin', 'distributor']);
```

### Server Action Wrappers

```typescript
import {
  roleAction,
  districtAdminAction,
  orgAdminAction,
  distributorAction,
  merchantAction
} from '../_lib/server/role-guards';

// Generic role action
export const myAction = roleAction(
  ['org_admin', 'distributor'],
  enhanceAction(async (data) => { ... }, { schema })
);

// Role-specific shortcuts
export const orgAction = orgAdminAction(enhanceAction(...));
export const distAction = distributorAction(enhanceAction(...));
export const merchAction = merchantAction(enhanceAction(...));
```

### Account ID Helpers

```typescript
import {
  getUserOrganizationId,
  getUserMerchantId,
  getUserDistrictId
} from '../_lib/server/role-guards';

// For org_admin: returns their organization account ID
// For distributor: returns the organization they belong to
const orgId = await getUserOrganizationId();

// For merchant: returns their merchant account ID
const merchantId = await getUserMerchantId();

// For district_admin: returns the district they administer (M1/T2)
const districtId = await getUserDistrictId();
```

---

## RLS Policies

All data access is protected by Row Level Security (RLS) policies at the database level:

| Table | Policy | Description |
|-------|--------|-------------|
| `organization_profiles` | `has_role_on_account(account_id, 'org_admin')` | Only org admins can modify |
| `merchant_profiles` | `has_role_on_account(account_id, 'merchant')` | Only merchants can modify |
| `cards` | Various policies | Based on org membership, distributor assignment, cardholder ownership |
| `discounts` | `has_role_on_account(merchant_id, 'merchant')` | Only merchant can modify their discounts |
| `redemptions` | Various policies | Based on card ownership or merchant association |

**Key RLS Helper Functions**:

- `is_super_admin()` - Returns true if user is super admin
- `has_role_on_account(account_id, role)` - Check role on specific account
- `has_platform_role(target_role)` - Check user's platform role
- `get_user_platform_role(user_id)` - Get user's role from memberships

---

## Adding a New Role-Protected Page

### Step 1: Create the page

```typescript
// apps/web/app/dashboard/(user)/org-admin/new-feature/page.tsx
import { requireOrgAdmin } from '../../_lib/server/role-guards';

export const metadata = {
  title: 'New Feature',
};

export default async function NewFeaturePage() {
  await requireOrgAdmin(); // Guard at top

  // Load data...

  return (
    <>
      <PageHeader title="New Feature" />
      <PageBody>
        {/* ... */}
      </PageBody>
    </>
  );
}
```

### Step 2: Create loader (if needed)

```typescript
// apps/web/app/dashboard/(user)/org-admin/new-feature/_lib/server/new-feature.loader.ts
import 'server-only';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserOrganizationId } from '../../../_lib/server/role-guards';

export async function loadNewFeatureData() {
  const client = getSupabaseServerClient();
  const orgId = await getUserOrganizationId();

  const { data } = await client
    .from('some_table')
    .select('*')
    .eq('organization_id', orgId);

  return data;
}
```

### Step 3: Create server actions (if needed)

```typescript
// apps/web/app/dashboard/(user)/org-admin/new-feature/_lib/server/new-feature-actions.ts
'use server';

import { enhanceAction } from '@kit/next/actions';
import { orgAdminAction } from '../../../_lib/server/role-guards';

export const createFeatureAction = orgAdminAction(
  enhanceAction(
    async (data) => {
      // ... action logic
      return { success: true };
    },
    { schema: CreateFeatureSchema }
  )
);
```

### Step 4: Add navigation (optional)

```typescript
// apps/web/app/dashboard/(user)/_components/org-admin-navigation.tsx
// Add link to new feature page
```

---

## Security Checklist

When adding role-protected features:

- [ ] Add `requireRole()` guard at top of page.tsx
- [ ] Wrap server actions with `roleAction()` or role-specific wrapper
- [ ] Use `getUserOrganizationId()` or `getUserMerchantId()` for data scoping
- [ ] Verify RLS policies cover the data access pattern
- [ ] Test with users of different roles
- [ ] Add navigation link only for appropriate roles
