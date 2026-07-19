'use server';

import { z } from 'zod';

import { isSuperAdmin } from '@kit/admin';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const SetOrgNonprofitAmountSchema = z.object({
  orgAccountId: z.string().uuid(),
  // Net cents to the nonprofit per card. Capped at $1,000/card as a sanity bound.
  cents: z.coerce.number().int().min(0).max(100_000),
});

/**
 * Sets an org's per-card nonprofit amount (ledger #21).
 *
 * SUPER-ADMIN ONLY (ledger #24): this rate determines what the nonprofit
 * receives, so a district editing it would change its own payout. The district
 * cause dashboard shows it read-only; only a super-admin may change it.
 *
 * // REVIEW: no super-admin UI wires this action yet — surface it on the
 * super-admin entities screen (alongside the org logo / district settings).
 */
export const setOrgNonprofitAmount = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    if (!(await isSuperAdmin(client))) {
      return { success: false as const, error: 'FORBIDDEN' };
    }

    const adminClient = getSupabaseServerAdminClient();
    const { error } = await adminClient
      .from('organization_profiles')
      .update({ nonprofit_cents_per_card: data.cents })
      .eq('account_id', data.orgAccountId);

    if (error) {
      return { success: false as const, error: error.message };
    }

    return { success: true as const };
  },
  { schema: SetOrgNonprofitAmountSchema },
);
