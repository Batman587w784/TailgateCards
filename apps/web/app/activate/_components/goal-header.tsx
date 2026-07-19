'use client';

import { useQuery } from '@tanstack/react-query';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Progress } from '@kit/ui/progress';

import { formatUsdFromCents } from '~/lib/currency';
import { type NamingPreset, getHierarchyLabels } from '~/lib/naming';

interface CheckoutGoals {
  per_card: { price_cents: number; net_cents: number };
  chapter: {
    cards_sold: number;
    raised_cents: number;
    goal_cents: number;
    progress: number;
  };
  distributor: {
    cards_sold: number;
    raised_cents: number;
    goal_cents: number;
    progress: number;
  } | null;
}

interface CampusSummary {
  total_raised_cents: number;
  goal_target_cents: number;
  goal_progress: number;
}

interface HeaderDistrict {
  id: string;
  name: string;
  type: string | null;
  naming_preset?: string | null;
  picture_url?: string | null;
  city?: string | null;
  state?: string | null;
}

interface GoalHeaderProps {
  orgId: string;
  orgName: string;
  city?: string | null;
  state?: string | null;
  logoUrl?: string | null;
  district?: HeaderDistrict | null;
  distributorId?: string | null;
  distributorName?: string | null;
}

function pct(p: number | null | undefined) {
  return Math.min(100, Math.max(0, Math.round((p ?? 0) * 100)));
}

/** First-letters of a name (max 2), e.g. "Rodrick Heffley" -> "RH". */
function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * M3 — purchase-page goal header, variant 3b (ledger #19).
 *
 * Headline rule (ledger #19): a campus-flagged district is the headline (its
 * logo + name + district-level goal) with the chapter shown smaller underneath;
 * otherwise the org is the headline. Bars show NET money to the headline entity
 * (ledger #20) — no split disclosure. Long names truncate gracefully.
 */
export function GoalHeader({
  orgId,
  orgName,
  city,
  state,
  logoUrl,
  district,
  distributorId,
  distributorName,
}: GoalHeaderProps) {
  const supabase = useSupabase();

  const isCampusHeadline = district?.type === 'campus';

  const { data: goals } = useQuery({
    queryKey: ['checkout-goals', orgId, distributorId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_checkout_goals', {
        p_org_account_id: orgId,
        ...(distributorId ? { p_distributor_account_id: distributorId } : {}),
      });

      if (error) throw error;

      return (data as unknown as CheckoutGoals | null) ?? null;
    },
  });

  // Campus-flagged headline uses the DISTRICT-level goal for the main bar.
  const { data: campus } = useQuery({
    queryKey: ['campus-summary', district?.id ?? null],
    enabled: Boolean(isCampusHeadline && district?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_campus_leaderboard_summary',
        { p_district_id: district!.id },
      );

      if (error) throw error;

      return (data as unknown as CampusSummary | null) ?? null;
    },
  });

  // Goal-bar label routed through the naming layer (ledger #6): the label names
  // the entity in that bar — the district tier for a campus headline
  // ("Campus goal"), the org tier for a chapter bar ("Chapter goal"), and a
  // generic "Campaign goal" when there's no district.
  const labels = getHierarchyLabels(
    district?.naming_preset as NamingPreset | null | undefined,
  );
  const goalLabel = isCampusHeadline
    ? `${labels.district.singular} goal`
    : district
      ? `${labels.organization.singular} goal`
      : 'Campaign goal';

  // Resolve the two shapes.
  const headline = isCampusHeadline
    ? {
        logo: district?.picture_url ?? null,
        name: district?.name ?? orgName,
        town: [district?.city, district?.state].filter(Boolean).join(', '),
        secondary: orgName,
      }
    : {
        logo: logoUrl ?? null,
        name: orgName,
        town: [city, state].filter(Boolean).join(', '),
        secondary: null as string | null,
      };

  const bar = isCampusHeadline
    ? campus
      ? {
          raised: campus.total_raised_cents,
          goal: campus.goal_target_cents,
          progress: campus.goal_progress,
        }
      : null
    : goals
      ? {
          raised: goals.chapter.raised_cents,
          goal: goals.chapter.goal_cents,
          progress: goals.chapter.progress,
        }
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Headline row: logo · name + secondary + town · right-aligned goal. */}
      <div className="flex items-start gap-3">
        {headline.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headline.logo}
            alt={headline.name}
            className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl leading-tight font-bold">
            {headline.name}
          </h1>
          {headline.secondary ? (
            <p className="text-muted-foreground truncate text-sm font-medium">
              {headline.secondary}
            </p>
          ) : null}
          {headline.town ? (
            <p className="text-muted-foreground truncate text-sm">
              {headline.town}
            </p>
          ) : null}
        </div>

        {bar ? (
          <div className="shrink-0 text-right">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
              {goalLabel}
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {formatUsdFromCents(bar.raised)} of {formatUsdFromCents(bar.goal)}
            </p>
          </div>
        ) : null}
      </div>

      {bar ? (
        <Progress value={pct(bar.progress)} className="h-2.5" />
      ) : null}

      {/* Distributor sub-goal — avatar/initials + "Supporting [Name]'s drive". */}
      {goals?.distributor && distributorName ? (
        <div className="flex items-start gap-2.5">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold">
            {initialsOf(distributorName)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">
                Supporting <b className="font-extrabold">{distributorName}</b>
                &apos;s drive
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {formatUsdFromCents(goals.distributor.raised_cents)} /{' '}
                {formatUsdFromCents(goals.distributor.goal_cents)}
              </span>
            </div>
            <Progress
              value={pct(goals.distributor.progress)}
              className="h-1.5"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
