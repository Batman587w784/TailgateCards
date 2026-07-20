import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { parseCompetitionWindow } from '~/lib/competition';
import type { Database } from '~/lib/database.types';

type Admin = SupabaseClient<Database>;

const TOP_CHAPTERS = 3;
const TOP_SELLERS = 3;

interface LadderShape {
  district_name: string;
  fundraiser_enabled: boolean;
  competition_start: string | null;
  competition_days: number | null;
  total_cards: number;
  tiers: Array<{ name: string; threshold_cards: number }>;
}

interface OrgDistrict {
  orgName: string;
  districtId: string | null;
  district: {
    name: string;
    district_type: string | null;
    config: unknown;
    fundraiser_enabled: boolean;
  } | null;
}

async function resolveOrgDistrict(
  admin: Admin,
  orgId: string,
): Promise<OrgDistrict> {
  const { data: op } = await admin
    .from('organization_profiles')
    .select('organization_name, district_id')
    .eq('account_id', orgId)
    .maybeSingle();

  const { data: acct } = await admin
    .from('accounts')
    .select('name')
    .eq('id', orgId)
    .maybeSingle();

  const orgName = op?.organization_name ?? acct?.name ?? 'Your chapter';
  const districtId = op?.district_id ?? null;

  if (!districtId) return { orgName, districtId: null, district: null };

  const { data: d } = await admin
    .from('districts')
    .select('name, district_type, config, fundraiser_enabled')
    .eq('id', districtId)
    .maybeSingle();

  return {
    orgName,
    districtId,
    district: d
      ? {
          name: d.name,
          district_type: d.district_type,
          config: d.config,
          fundraiser_enabled: d.fundraiser_enabled,
        }
      : null,
  };
}

/** Days left in the district's competition window (for cron cadence), or null. */
export async function districtDaysLeft(
  admin: Admin,
  orgId: string,
): Promise<number | null> {
  const { district } = await resolveOrgDistrict(admin, orgId);
  if (!district) return null;
  const w = parseCompetitionWindow(district.config);
  return w && w.isOpen ? w.daysLeft : null;
}

function collectiveBlock(
  ladder: LadderShape,
  config: unknown,
): string | null {
  if (!ladder.fundraiser_enabled) return null;

  const lines = [`🏆 ${ladder.district_name} fundraiser`];
  lines.push(`${ladder.total_cards} cards sold so far`);

  const next = ladder.tiers.find((t) => ladder.total_cards < t.threshold_cards);
  if (next) {
    const remaining = next.threshold_cards - ladder.total_cards;
    lines.push(`Next up: ${next.name} — ${remaining} to go`);
  } else if (ladder.tiers.length) {
    lines.push(`🎉 Every prize unlocked!`);
  }

  const w = parseCompetitionWindow(config);
  if (w && w.isOpen) {
    lines.push(`⏳ ${w.daysLeft} ${w.daysLeft === 1 ? 'day' : 'days'} left`);
  }

  return lines.join('\n');
}

async function chapterBlock(
  admin: Admin,
  districtId: string,
  orgId: string,
): Promise<string | null> {
  const { data } = await admin.rpc('get_campus_chapter_leaderboard', {
    p_district_id: districtId,
  });
  const rows = data ?? [];
  if (!rows.length) return null;

  const lines = ['📊 Chapter standings'];
  for (const r of rows.slice(0, TOP_CHAPTERS)) {
    const you = r.org_account_id === orgId ? ' (you)' : '';
    lines.push(`${r.rank}. ${r.chapter_name} — ${r.cards_sold}${you}`);
  }

  // If the connected chapter is outside the top rows, tack on its own standing so
  // the drop always tells them where they sit.
  const self = rows.find((r) => r.org_account_id === orgId);
  if (self && self.rank > TOP_CHAPTERS) {
    lines.push(`…`);
    lines.push(`${self.rank}. ${self.chapter_name} — ${self.cards_sold} (you)`);
  }

  return lines.join('\n');
}

async function sellersBlock(
  admin: Admin,
  districtId: string,
): Promise<string | null> {
  const { data } = await admin.rpc('get_campus_member_leaderboard', {
    p_district_id: districtId,
    p_limit: TOP_SELLERS,
  });
  const rows = data ?? [];
  if (!rows.length) return null;

  const lines = ['🔥 Top sellers'];
  for (const r of rows) {
    lines.push(`${r.rank}. ${r.display_name} — ${r.cards_sold}`);
  }
  return lines.join('\n');
}

async function standaloneBlock(
  admin: Admin,
  orgId: string,
  orgName: string,
): Promise<string | null> {
  const { data } = await admin.rpc('get_chapter_member_leaderboard', {
    p_org_account_id: orgId,
    p_limit: TOP_SELLERS,
  });
  const rows = data ?? [];
  if (!rows.length) return null;

  const lines = [`🔥 ${orgName} — top sellers`];
  for (const r of rows) {
    lines.push(`${r.rank}. ${r.display_name} — ${r.cards_sold}`);
  }
  return lines.join('\n');
}

/**
 * Compose the text-first weekly drop for a connected chapter: three blocks for a
 * campus chapter (district collective + next prize + countdown, chapter standings,
 * top sellers), or a single top-sellers block for a standalone org. Returns null
 * when there is genuinely nothing to say (no cards yet), so the cron can skip.
 */
export async function composeDrop(
  admin: Admin,
  orgId: string,
): Promise<string | null> {
  const { orgName, districtId, district } = await resolveOrgDistrict(
    admin,
    orgId,
  );

  // Standalone org (no district) — no leaderboard, just its own sellers.
  if (!districtId || district?.district_type !== 'campus') {
    return standaloneBlock(admin, orgId, orgName);
  }

  const { data: ladderData } = await admin.rpc('get_district_ladder', {
    p_district_id: districtId,
  });
  const ladder = ladderData as unknown as LadderShape | null;

  const blocks = [
    ladder ? collectiveBlock(ladder, district?.config ?? null) : null,
    await chapterBlock(admin, districtId, orgId),
    await sellersBlock(admin, districtId),
  ].filter((b): b is string => Boolean(b));

  if (!blocks.length) return null;
  return blocks.join('\n\n');
}
