import 'server-only';

import { cache } from 'react';

import { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { Database } from '~/lib/database.types';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export type CardholderSettings = Awaited<
  ReturnType<typeof loadCardholderSettings>
>;

export const loadCardholderSettings = cache(async () => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  return fetchCardholderSettings(client, user.id);
});

async function fetchCardholderSettings(
  client: SupabaseClient<Database>,
  userId: string,
) {
  // Get user email from auth
  const {
    data: { user },
  } = await client.auth.getUser();

  // Get account data (may not exist for super admins)
  const { data: account } = await client
    .from('accounts')
    .select('id, email')
    .eq('primary_owner_user_id', userId)
    .eq('is_personal_account', true)
    .maybeSingle();

  // If no personal account exists (e.g., super admin), return basic info
  if (!account) {
    return {
      accountId: null,
      email: user?.email ?? '',
      firstName: '',
      lastName: '',
      phone: '',
    };
  }

  // Get cardholder profile
  const { data: profile } = await client
    .from('cardholder_profiles')
    .select('first_name, last_name, phone')
    .eq('account_id', account.id)
    .maybeSingle();

  return {
    accountId: account.id,
    email: account.email,
    firstName: profile?.first_name ?? '',
    lastName: profile?.last_name ?? '',
    phone: profile?.phone ?? '',
  };
}
