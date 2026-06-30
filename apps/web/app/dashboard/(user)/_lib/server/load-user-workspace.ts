import { cache } from 'react';

import { createAccountsApi } from '@kit/accounts/api';
import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import featureFlagsConfig from '~/config/feature-flags.config';
import { Database } from '~/lib/database.types';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

const shouldLoadAccounts = featureFlagsConfig.enableTeamAccounts;

export type PlatformRole = Database['public']['Enums']['platform_role'] | null;

export type UserWorkspace = Awaited<ReturnType<typeof loadUserWorkspace>>;

/**
 * @name loadUserWorkspace
 * @description
 * Load the user workspace data. It's a cached per-request function that fetches the user workspace data.
 * It can be used across the server components to load the user workspace data.
 */
export const loadUserWorkspace = cache(workspaceLoader);

async function workspaceLoader() {
  // IMPORTANT: Check auth and MFA first, before any database queries.
  // MFA-enabled users need aal2 token to pass RLS policies on accounts table.
  // This ensures proper redirect to /auth/verify if MFA is not completed.
  const user = await requireUserInServerComponent();

  const client = getSupabaseServerClient();
  const api = createAccountsApi(client);

  // Now safe to query database - user has passed auth and MFA checks
  const [accounts, platformRoleResult, superAdminStatus] = await Promise.all([
    shouldLoadAccounts ? api.loadUserAccounts() : Promise.resolve([]),
    client.rpc('get_user_platform_role', { target_user_id: user.id }),
    isSuperAdmin(client),
  ]);

  // Cast string result to PlatformRole enum type
  const platformRole: PlatformRole =
    (platformRoleResult.data as PlatformRole) ?? null;

  let distributorShareSlug: string | null = null;

  if (platformRole === 'distributor') {
    const { data } = await client
      .from('accounts_memberships')
      .select('share_slug')
      .eq('user_id', user.id)
      .eq('account_role', 'distributor')
      .limit(1)
      .maybeSingle();

    distributorShareSlug = data?.share_slug ?? null;
  }

  let orgShareSlug: string | null = null;

  if (platformRole === 'org_admin') {
    const { data: membership } = await client
      .from('accounts_memberships')
      .select('account_id')
      .eq('user_id', user.id)
      .eq('account_role', 'org_admin')
      .limit(1)
      .maybeSingle();

    if (membership?.account_id) {
      const { data: account } = await client
        .from('accounts')
        .select('slug')
        .eq('id', membership.account_id)
        .maybeSingle();

      orgShareSlug = account?.slug ?? null;
    }
  }

  return {
    accounts,
    workspace: null,
    user,
    platformRole,
    isSuperAdmin: superAdminStatus,
    distributorShareSlug,
    orgShareSlug,
  };
}
