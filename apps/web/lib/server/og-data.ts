import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { parseCompetitionWindow } from '~/lib/competition';
import type { Database } from '~/lib/database.types';
import type { OgCardData } from '~/lib/og-card';

function usd(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

function countdown(start: string | null, days: number | null): string | null {
  const w = parseCompetitionWindow({
    competition_start: start,
    competition_days: days,
  });
  if (!w || w.isClosed) return null;
  return `${w.daysLeft} ${w.daysLeft === 1 ? 'day' : 'days'} left`;
}

interface LadderShape {
  total_cards: number;
  competition_start: string | null;
  competition_days: number | null;
}

interface GoalsShape {
  chapter: { raised_cents: number; goal_cents: number; progress: number };
}

type Admin = SupabaseClient<Database>;

async function districtCountdown(
  admin: Admin,
  districtId: string,
): Promise<string | null> {
  const { data } = await admin.rpc('get_district_ladder', {
    p_district_id: districtId,
  });
  const ladder = data as unknown as LadderShape | null;
  return ladder ? countdown(ladder.competition_start, ladder.competition_days) : null;
}

async function chapterProgress(
  admin: Admin,
  orgId: string,
): Promise<Pick<OgCardData, 'progressLabel' | 'progressPct'>> {
  const { data } = await admin.rpc('get_checkout_goals', {
    p_org_account_id: orgId,
  });
  const goals = data as unknown as GoalsShape | null;
  if (!goals?.chapter) return {};
  return {
    progressLabel: `${usd(goals.chapter.raised_cents)} of ${usd(goals.chapter.goal_cents)}`,
    progressPct: Math.round((goals.chapter.progress ?? 0) * 100),
  };
}

/** Shared shape returned by both buy-page RPCs (org + distributor). */
interface BuyPageRow {
  organization_id: string;
  organization_name: string | null;
  organization_picture_url: string | null;
  organization_city: string | null;
  organization_state: string | null;
  district_id: string | null;
  district_name: string | null;
  district_type: string | null;
  district_picture_url: string | null;
}

function buyCard(row: BuyPageRow): OgCardData {
  const isCampus = row.district_type === 'campus';
  const town = [row.organization_city, row.organization_state]
    .filter(Boolean)
    .join(', ');

  // Headline entity follows the purchase header rule (ledger #19).
  return isCampus
    ? {
        title: row.district_name ?? row.organization_name ?? 'Tailgate',
        subtitle: row.organization_name,
        logoUrl: row.district_picture_url,
      }
    : {
        title: row.organization_name ?? 'Tailgate',
        subtitle: town || null,
        logoUrl: row.organization_picture_url,
      };
}

export async function ogForOrgBuy(slug: string): Promise<OgCardData | null> {
  const admin = getSupabaseServerAdminClient();
  const { data } = await admin.rpc('get_organization_buy_page', { p_slug: slug });
  const row = data?.[0] as BuyPageRow | undefined;
  if (!row) return null;

  const card = buyCard(row);
  const progress = await chapterProgress(admin, row.organization_id);
  const days = row.district_id
    ? await districtCountdown(admin, row.district_id)
    : null;

  return { ...card, ...progress, countdown: days };
}

export async function ogForDistributorBuy(
  slug: string,
): Promise<OgCardData | null> {
  const admin = getSupabaseServerAdminClient();
  const { data } = await admin.rpc('get_distributor_buy_page', { p_slug: slug });
  const row = data?.[0] as (BuyPageRow & { distributor_name: string | null }) | undefined;
  if (!row) return null;

  const card = buyCard(row);
  const progress = await chapterProgress(admin, row.organization_id);
  const days = row.district_id
    ? await districtCountdown(admin, row.district_id)
    : null;

  // A distributor link is "sold by [name]".
  return {
    ...card,
    subtitle: row.distributor_name
      ? `with ${row.distributor_name}`
      : card.subtitle,
    ...progress,
    countdown: days,
  };
}

export async function ogForCampus(slug: string): Promise<OgCardData | null> {
  const admin = getSupabaseServerAdminClient();
  const { data } = await admin.rpc('get_public_campus', { p_share_slug: slug });
  const campus = data?.[0] as
    | { district_id: string; campus_name: string }
    | undefined;
  if (!campus) return null;

  const [{ data: sumData }, { data: districtRow }] = await Promise.all([
    admin.rpc('get_campus_leaderboard_summary', {
      p_district_id: campus.district_id,
    }),
    admin
      .from('districts')
      .select('logo_url, config')
      .eq('id', campus.district_id)
      .single(),
  ]);

  const summary = sumData as unknown as {
    total_raised_cents: number;
    goal_target_cents: number;
    goal_progress: number | null;
  } | null;

  const config = districtRow?.config as Record<string, unknown> | null;

  return {
    title: campus.campus_name,
    subtitle: 'Live fundraising standings',
    logoUrl: districtRow?.logo_url ?? null,
    progressLabel: summary
      ? `${usd(summary.total_raised_cents)} of ${usd(summary.goal_target_cents)}`
      : null,
    progressPct: summary ? Math.round((summary.goal_progress ?? 0) * 100) : null,
    countdown: countdown(
      (config?.competition_start as string) ?? null,
      (config?.competition_days as number) ?? null,
    ),
  };
}
