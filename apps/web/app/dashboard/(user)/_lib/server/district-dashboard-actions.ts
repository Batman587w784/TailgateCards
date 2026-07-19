'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { districtAdminAction } from './role-guards';

const SetOrgNonprofitAmountSchema = z.object({
  orgAccountId: z.string().uuid(),
  // Net cents to the nonprofit per card. Capped at $1,000/card as a sanity bound.
  cents: z.coerce.number().int().min(0).max(100_000),
});

/**
 * District admin sets an org's per-card nonprofit amount (ledger #21). Gated
 * two ways: districtAdminAction (role) + org_in_my_district (the org must belong
 * to the caller's district). The write uses the admin client because those two
 * checks fully establish authorization.
 */
export const setOrgNonprofitAmount = districtAdminAction(
  enhanceAction(
    async (data) => {
      const client = getSupabaseServerClient();

      const { data: inDistrict } = await client.rpc('org_in_my_district', {
        target_org_account_id: data.orgAccountId,
      });

      if (!inDistrict) {
        return { success: false as const, error: 'ORG_NOT_IN_DISTRICT' };
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
  ),
);
