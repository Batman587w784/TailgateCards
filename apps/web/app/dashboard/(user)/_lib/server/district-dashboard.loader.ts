import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getUserDistrictId } from './role-guards';

export interface DistrictCauseOrg {
  org_account_id: string;
  organization_name: string;
  cards_sold: number;
  nonprofit_cents_per_card: number;
  cause_raised_cents: number;
}

export interface DistrictSummary {
  campus_name: string;
  total_raised_cents: number;
  total_cards_sold: number;
  goal_target_cents: number;
  goal_progress: number;
}

export interface DistrictDashboardData {
  districtId: string | null;
  summary: DistrictSummary | null;
  orgs: DistrictCauseOrg[];
}

/**
 * District-admin home dashboard (ledger #21): the district goal (net cause
 * dollars, via get_campus_leaderboard_summary) plus a per-org breakdown of
 * cards sold + amount raised for the cause + the editable per-org nonprofit
 * rate (get_district_cause_dashboard).
 */
export async function loadDistrictDashboard(): Promise<DistrictDashboardData> {
  const client = getSupabaseServerClient();
  const districtId = await getUserDistrictId();

  if (!districtId) {
    return { districtId: null, summary: null, orgs: [] };
  }

  const [summaryRes, orgsRes] = await Promise.all([
    client.rpc('get_campus_leaderboard_summary', { p_district_id: districtId }),
    client.rpc('get_district_cause_dashboard', { p_district_id: districtId }),
  ]);

  return {
    districtId,
    summary: (summaryRes.data as unknown as DistrictSummary | null) ?? null,
    orgs: (orgsRes.data as DistrictCauseOrg[] | null) ?? [],
  };
}
