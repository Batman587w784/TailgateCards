import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isSuperAdmin } from '@kit/admin';

import type { Database } from '~/lib/database.types';
import type { NamingPreset } from '~/lib/naming';

import {
  getPlatformRole,
  getUserDistrictId,
  getUserOrganizationId,
} from '../../../_lib/server/role-guards';

export interface MyPosition {
  org_account_id: string;
  district_id: string | null;
  cards_sold: number;
  dollars_raised_cents: number;
  chapter_rank: number;
  goal_target_cards: number | null;
  goal_target_cents: number | null;
  goal_progress: number | null;
}

export interface CampusSummary {
  district_id: string;
  campus_name: string;
  naming_preset: NamingPreset;
  total_raised_cents: number;
  total_cards_sold: number;
  chapter_count: number;
  goal_target_cents: number | null;
  goal_progress: number | null;
}

export interface ChapterRow {
  rank: number;
  org_account_id: string;
  chapter_name: string;
  cards_sold: number;
  dollars_raised_cents: number;
  goal_target_cards: number | null;
  goal_target_cents: number | null;
  goal_progress: number | null;
}

export interface MemberRow {
  rank: number;
  display_name: string;
  cards_sold: number;
  dollars_raised_cents: number;
  goal_target_cards: number | null;
  goal_target_cents: number | null;
  goal_progress: number | null;
}

/**
 * Which member board is shown:
 *  - 'chapter' -> a single chapter's members (member/org-admin view: own chapter)
 *  - 'campus'  -> members across the whole campus (district-admin/super-admin)
 */
export type MembersScope = 'chapter' | 'campus';

export interface MemberLeaderboardData {
  position: MyPosition | null;
  summary: CampusSummary | null;
  chapters: ChapterRow[];
  members: MemberRow[];
  membersScope: MembersScope;
}

/**
 * P0-4 — role-aware leaderboard loader. Resolves the right campus/chapter per
 * role and reuses the M2 RPCs (unchanged PII scope: individual members are only
 * exposed for one chapter at a time, or the campus board which is already public
 * on /l/[slug]).
 *
 *  - member (distributor) -> own chapter members + own rank (view unchanged)
 *  - org_admin            -> their chapter's members + campus chapter standings
 *  - district_admin       -> their campus: chapter standings + campus members
 *  - super-admin          -> most recent active campus (// REVIEW: campus picker)
 */
export async function loadMemberLeaderboard(
  client: SupabaseClient<Database>,
): Promise<MemberLeaderboardData> {
  const admin = await isSuperAdmin(client);
  const role = admin ? 'super-admin' : await getPlatformRole(client);

  let position: MyPosition | null = null;
  let orgId: string | null = null;
  let districtId: string | null = null;
  let membersScope: MembersScope = 'chapter';

  if (role === 'distributor') {
    const { data } = await client.rpc('get_my_leaderboard_position');
    position = (data as MyPosition | null) ?? null;
    orgId = position?.org_account_id ?? null;
    districtId = position?.district_id ?? null;
  } else if (role === 'org_admin') {
    orgId = await getUserOrganizationId();

    if (orgId) {
      const { data: op } = await client
        .from('organization_profiles')
        .select('district_id')
        .eq('account_id', orgId)
        .maybeSingle();

      districtId = op?.district_id ?? null;
    }
  } else if (role === 'district_admin') {
    districtId = await getUserDistrictId();
    membersScope = 'campus';
  } else if (admin) {
    // super-admin has no single campus context.
    // REVIEW: default to the most recent active campus; a campus picker for
    // super-admin is a sensible follow-up.
    const { data: d } = await client
      .from('districts')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    districtId = d?.id ?? null;
    membersScope = 'campus';
  }

  if (!districtId) {
    return { position, summary: null, chapters: [], members: [], membersScope };
  }

  const [summaryRes, chaptersRes, membersRes] = await Promise.all([
    client.rpc('get_campus_leaderboard_summary', { p_district_id: districtId }),
    client.rpc('get_campus_chapter_leaderboard', { p_district_id: districtId }),
    orgId
      ? client.rpc('get_chapter_member_leaderboard', { p_org_account_id: orgId })
      : client.rpc('get_campus_member_leaderboard', {
          p_district_id: districtId,
          p_limit: 100,
        }),
  ]);

  return {
    position,
    summary: (summaryRes.data as CampusSummary | null) ?? null,
    chapters: (chaptersRes.data as ChapterRow[] | null) ?? [],
    members: (membersRes.data as MemberRow[] | null) ?? [],
    membersScope,
  };
}
