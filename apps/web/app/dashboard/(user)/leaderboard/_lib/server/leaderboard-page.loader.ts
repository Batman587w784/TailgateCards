import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '~/lib/database.types';
import type { NamingPreset } from '~/lib/naming';

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

export interface MemberLeaderboardData {
  position: MyPosition | null;
  summary: CampusSummary | null;
  chapters: ChapterRow[];
  members: MemberRow[];
}

/**
 * M2-T3 — loads the authenticated member's leaderboard view: their own rank +
 * their chapter's member standings + their campus's chapter standings + campus
 * total. All data comes from the M2-T1/T2 RPCs (zero-PII, goal-aware).
 */
export async function loadMemberLeaderboard(
  client: SupabaseClient<Database>,
): Promise<MemberLeaderboardData> {
  const { data: positionRaw } = await client.rpc('get_my_leaderboard_position');
  const position = (positionRaw as MyPosition | null) ?? null;

  if (!position || !position.district_id) {
    return { position, summary: null, chapters: [], members: [] };
  }

  const [summaryRes, chaptersRes, membersRes] = await Promise.all([
    client.rpc('get_campus_leaderboard_summary', {
      p_district_id: position.district_id,
    }),
    client.rpc('get_campus_chapter_leaderboard', {
      p_district_id: position.district_id,
    }),
    client.rpc('get_chapter_member_leaderboard', {
      p_org_account_id: position.org_account_id,
    }),
  ]);

  return {
    position,
    summary: (summaryRes.data as CampusSummary | null) ?? null,
    chapters: (chaptersRes.data as ChapterRow[] | null) ?? [],
    members: (membersRes.data as MemberRow[] | null) ?? [],
  };
}
