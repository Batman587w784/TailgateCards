'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  districtAdminAction,
  getUserDistrictId,
  getUserOrganizationId,
  orgAdminAction,
} from './role-guards';

const LogoUrlSchema = z.object({ logoUrl: z.string().url() });

/**
 * Org admin sets their OWN organization's logo (accounts.picture_url), so
 * get_effective_org_logo / the district "standardize logos" flag keep working.
 * Scoped to the caller's org via getUserOrganizationId — the account id is never
 * taken from the client.
 */
export const updateOrganizationLogoAction = orgAdminAction(
  enhanceAction(
    async (data) => {
      const orgId = await getUserOrganizationId();

      if (!orgId) {
        return { success: false as const, error: 'NO_ORGANIZATION' };
      }

      const client = getSupabaseServerAdminClient();
      const { error } = await client
        .from('accounts')
        .update({ picture_url: data.logoUrl })
        .eq('id', orgId);

      if (error) {
        return { success: false as const, error: error.message };
      }

      return { success: true as const };
    },
    { schema: LogoUrlSchema },
  ),
);

/**
 * District admin sets their OWN district's logo (districts.logo_url). Scoped to
 * the caller's district via getUserDistrictId.
 */
export const updateDistrictLogoSelfAction = districtAdminAction(
  enhanceAction(
    async (data) => {
      const districtId = await getUserDistrictId();

      if (!districtId) {
        return { success: false as const, error: 'NO_DISTRICT' };
      }

      const client = getSupabaseServerAdminClient();
      const { error } = await client
        .from('districts')
        .update({ logo_url: data.logoUrl })
        .eq('id', districtId);

      if (error) {
        return { success: false as const, error: error.message };
      }

      return { success: true as const };
    },
    { schema: LogoUrlSchema },
  ),
);
