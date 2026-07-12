import 'server-only';

import { notFound } from 'next/navigation';

import { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { Database } from '~/lib/database.types';

/**
 * Platform roles available in the system.
 *
 * Roles hierarchy (highest to lowest):
 * 1. district_admin - Campus/District admin (M1/T2), scoped to one district
 * 2. org_admin - Organization administrator
 * 3. distributor - Sells cards on behalf of organization
 * 4. merchant - Merchant (validates discounts, views analytics with passcode)
 * 5. cardholder - Default role for NFC card holders
 *
 * Note: Super admin is separate (JWT-based with MFA requirement)
 */
export type PlatformRole = Database['public']['Enums']['platform_role'];

// ============================================================
// Role Check Functions
// ============================================================

/**
 * Check if user has a specific platform role.
 * Uses the has_platform_role() RPC that checks accounts_memberships.
 */
export async function hasPlatformRole(
  client: SupabaseClient<Database>,
  role: PlatformRole,
): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('has_platform_role', {
      target_role: role,
    });

    if (error) {
      throw error;
    }

    return data ?? false;
  } catch {
    return false;
  }
}

/**
 * Get the user's current platform role.
 * Returns 'cardholder' as default if no role is found.
 */
export async function getPlatformRole(
  client: SupabaseClient<Database>,
): Promise<PlatformRole> {
  try {
    const { data, error } = await client.rpc('get_platform_role');

    if (error) {
      throw error;
    }

    return (data as PlatformRole) ?? 'cardholder';
  } catch {
    return 'cardholder';
  }
}

/**
 * Check if user is an organization admin.
 */
export async function isOrgAdmin(
  client: SupabaseClient<Database>,
): Promise<boolean> {
  return hasPlatformRole(client, 'org_admin');
}

/**
 * Check if user is a district admin (Campus/District level, M1/T2).
 */
export async function isDistrictAdmin(
  client: SupabaseClient<Database>,
): Promise<boolean> {
  return hasPlatformRole(client, 'district_admin');
}

/**
 * Check if user is a distributor.
 */
export async function isDistributor(
  client: SupabaseClient<Database>,
): Promise<boolean> {
  return hasPlatformRole(client, 'distributor');
}

/**
 * Check if user is a merchant.
 */
export async function isMerchant(
  client: SupabaseClient<Database>,
): Promise<boolean> {
  return hasPlatformRole(client, 'merchant');
}

/**
 * Check if user is a cardholder.
 */
export async function isCardholder(
  client: SupabaseClient<Database>,
): Promise<boolean> {
  return hasPlatformRole(client, 'cardholder');
}

// ============================================================
// Require Role Functions (Guard Functions)
// These return 404 if user doesn't have the required role.
// Use in page.tsx files to protect routes.
// ============================================================

/**
 * Require org_admin role or return 404.
 * Use at the top of page.tsx files for org-admin-only routes.
 *
 * @example
 * ```typescript
 * // apps/web/app/dashboard/(user)/org-admin/distributors/page.tsx
 * export default async function DistributorsPage() {
 *   await requireOrgAdmin();
 *   // ... rest of page logic
 * }
 * ```
 */
export async function requireOrgAdmin(): Promise<void> {
  const client = getSupabaseServerClient();

  if (!(await isOrgAdmin(client))) {
    notFound();
  }
}

/**
 * Require district_admin role or return 404 (M1/T2).
 * Use at the top of page.tsx files for district-admin-only routes.
 *
 * @example
 * ```typescript
 * export default async function DistrictDashboardPage() {
 *   await requireDistrictAdmin();
 *   // ... rest of page logic
 * }
 * ```
 */
export async function requireDistrictAdmin(): Promise<void> {
  const client = getSupabaseServerClient();

  if (!(await isDistrictAdmin(client))) {
    notFound();
  }
}

/**
 * Require distributor role or return 404.
 * Use at the top of page.tsx files for distributor-only routes.
 *
 * @example
 * ```typescript
 * // apps/web/app/dashboard/(user)/distributor/cards/page.tsx
 * export default async function CardsPage() {
 *   await requireDistributor();
 *   // ... rest of page logic
 * }
 * ```
 */
export async function requireDistributor(): Promise<void> {
  const client = getSupabaseServerClient();

  if (!(await isDistributor(client))) {
    notFound();
  }
}

/**
 * Require merchant role or return 404.
 * Use at the top of page.tsx files for merchant-only routes.
 *
 * @example
 * ```typescript
 * // apps/web/app/dashboard/(user)/merchant/validate/page.tsx
 * export default async function ValidatePage() {
 *   await requireMerchant();
 *   // ... rest of page logic
 * }
 * ```
 */
export async function requireMerchant(): Promise<void> {
  const client = getSupabaseServerClient();

  if (!(await isMerchant(client))) {
    notFound();
  }
}

/**
 * Require cardholder role or return 404.
 * Use at the top of page.tsx files for cardholder-only routes.
 */
export async function requireCardholder(): Promise<void> {
  const client = getSupabaseServerClient();

  if (!(await isCardholder(client))) {
    notFound();
  }
}

/**
 * Require any of the specified roles or return 404.
 * Use when multiple roles can access a route.
 *
 * @example
 * ```typescript
 * // Page accessible by both org_admin and distributor
 * export default async function SharedPage() {
 *   await requireAnyRole(['org_admin', 'distributor']);
 *   // ... rest of page logic
 * }
 * ```
 */
export async function requireAnyRole(roles: PlatformRole[]): Promise<void> {
  const client = getSupabaseServerClient();
  const userRole = await getPlatformRole(client);

  if (!roles.includes(userRole)) {
    notFound();
  }
}

// ============================================================
// Server Action Wrappers
// Use these to protect server actions with role checks.
// ============================================================

/**
 * Wrap a server action to require specific role(s).
 * Returns 404 if user doesn't have the required role.
 *
 * @example
 * ```typescript
 * // apps/web/app/dashboard/(user)/org-admin/_lib/server/org-actions.ts
 * 'use server';
 *
 * export const addDistributorAction = roleAction(
 *   ['org_admin'],
 *   enhanceAction(
 *     async (data) => {
 *       // ... action logic
 *     },
 *     { schema: AddDistributorSchema }
 *   )
 * );
 * ```
 */
export function roleAction<Args, Response>(
  allowedRoles: PlatformRole[],
  fn: (params: Args) => Response,
) {
  return async (params: Args) => {
    const client = getSupabaseServerClient();
    const userRole = await getPlatformRole(client);

    if (!allowedRoles.includes(userRole)) {
      notFound();
    }

    return fn(params);
  };
}

/**
 * Wrap a server action to require org_admin role.
 *
 * @example
 * ```typescript
 * export const updateOrgAction = orgAdminAction(
 *   enhanceAction(async (data) => { ... }, { schema })
 * );
 * ```
 */
export function orgAdminAction<Args, Response>(fn: (params: Args) => Response) {
  return roleAction(['org_admin'], fn);
}

/**
 * Wrap a server action to require district_admin role (M1/T2).
 */
export function districtAdminAction<Args, Response>(
  fn: (params: Args) => Response,
) {
  return roleAction(['district_admin'], fn);
}

/**
 * Wrap a server action to require distributor role.
 */
export function distributorAction<Args, Response>(
  fn: (params: Args) => Response,
) {
  return roleAction(['distributor'], fn);
}

/**
 * Wrap a server action to require merchant role.
 */
export function merchantAction<Args, Response>(fn: (params: Args) => Response) {
  return roleAction(['merchant'], fn);
}

// ============================================================
// Account ID Helpers
// Get the user's associated organization/merchant account ID.
// ============================================================

/**
 * Get the user's organization account ID.
 * For org_admin: returns the organization they manage.
 * For distributor: returns the organization they belong to.
 *
 * @returns Organization account ID or null if user has no org association
 */
export async function getUserOrganizationId(): Promise<string | null> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  // Get organization from accounts_memberships where role is org_admin or distributor
  const { data } = await client
    .from('accounts_memberships')
    .select(
      `
      account_id,
      account_role
    `,
    )
    .eq('user_id', user.id)
    .in('account_role', ['org_admin', 'distributor'])
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  // For org_admin, the account_id is the organization
  // For distributor, we need to get the organization_id from the account
  if (data.account_role === 'org_admin') {
    return data.account_id;
  }

  // For distributor, get the organization_id from their account
  const { data: account } = await client
    .from('accounts')
    .select('organization_id')
    .eq('id', data.account_id)
    .single();

  return account?.organization_id ?? null;
}

/**
 * Get the user's merchant account ID.
 *
 * @returns Merchant account ID or null if user is not a merchant
 */
export async function getUserMerchantId(): Promise<string | null> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  const { data } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('user_id', user.id)
    .eq('account_role', 'merchant')
    .limit(1)
    .maybeSingle();

  return data?.account_id ?? null;
}

/**
 * Get the district ID the current user administers (M1/T2).
 * District admins are scoped to a single district via district_memberships.
 *
 * @returns District ID, or null if the user is not a district admin
 */
export async function getUserDistrictId(): Promise<string | null> {
  const client = getSupabaseServerClient();

  const { data, error } = await client.rpc('get_user_district_id');

  if (error) {
    return null;
  }

  return data ?? null;
}
