import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  DEFAULT_NAMING_PRESET,
  getHierarchyLabels,
  type HierarchyLabels,
  type NamingPreset,
} from '~/lib/naming';

/**
 * M1 / T4 — resolve the naming preset for the current user's district context
 * (district_admin -> their district; org member -> their org's district; else
 * default). Backed by the `get_user_naming_preset` RPC.
 */
export async function getUserNamingPreset(): Promise<NamingPreset> {
  const client = getSupabaseServerClient();
  const { data, error } = await client.rpc('get_user_naming_preset');

  if (error || !data) {
    return DEFAULT_NAMING_PRESET;
  }

  return data;
}

/** Convenience: the resolved hierarchy labels for the current user. */
export async function getUserNamingLabels(): Promise<HierarchyLabels> {
  return getHierarchyLabels(await getUserNamingPreset());
}

/**
 * Resolve the naming labels for a specific district (e.g. the signup picker in
 * T5/T6, before the user has any membership). Backed by
 * `get_district_naming_preset`.
 */
export async function getDistrictNamingLabels(
  districtId: string,
): Promise<HierarchyLabels> {
  const client = getSupabaseServerClient();
  const { data, error } = await client.rpc('get_district_naming_preset', {
    p_district_id: districtId,
  });

  return getHierarchyLabels(error ? DEFAULT_NAMING_PRESET : data);
}
