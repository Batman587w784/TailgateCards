'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const MarkWalletAddedSchema = z.object({
  platform: z.enum(['apple', 'google']),
});

export const markCardholderWalletAdded = enhanceAction(
  async ({ platform }, user) => {
    const client = getSupabaseServerClient();

    const { data: personalAccount } = await client
      .from('accounts')
      .select('id')
      .eq('primary_owner_user_id', user.id)
      .eq('is_personal_account', true)
      .single();

    if (!personalAccount) {
      return { success: false as const };
    }

    const column =
      platform === 'apple' ? 'apple_wallet_added_at' : 'google_wallet_added_at';

    const { error } = await client
      .from('cardholder_profiles')
      .update({ [column]: new Date().toISOString() })
      .eq('account_id', personalAccount.id);

    if (error) {
      return { success: false as const };
    }

    return { success: true as const };
  },
  { auth: true, schema: MarkWalletAddedSchema },
);
