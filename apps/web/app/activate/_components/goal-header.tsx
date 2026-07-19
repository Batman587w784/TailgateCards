'use client';

import { useQuery } from '@tanstack/react-query';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Progress } from '@kit/ui/progress';

import { formatUsdFromCents } from '~/lib/currency';

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

interface GoalHeaderProps {
  orgId: string;
  orgName: string;
  city?: string | null;
  state?: string | null;
  logoUrl?: string | null;
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
 * M3 / P1-1 — purchase-page goal header. Chapter logo (effective, via
 * get_effective_org_logo) + name + town, a GROSS campaign goal bar (decision
 * #12), a split-disclosure line, and the distributor's sub-goal.
 */
export function GoalHeader({
  orgId,
  orgName,
  city,
  state,
  logoUrl,
  distributorId,
  distributorName,
}: GoalHeaderProps) {
  const supabase = useSupabase();

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

  const town = [city, state].filter(Boolean).join(', ');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={orgName}
            className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold leading-tight">{orgName}</h1>
          {town ? (
            <p className="text-muted-foreground text-sm">{town}</p>
          ) : null}
        </div>
      </div>

      {goals ? (
        <div className="flex flex-col gap-3">
          {/* Chapter campaign goal — GROSS campaign dollars (decision #12). */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{orgName} campaign goal</span>
              <span className="tabular-nums">
                {formatUsdFromCents(goals.chapter.raised_cents)} of{' '}
                {formatUsdFromCents(goals.chapter.goal_cents)}
              </span>
            </div>
            <Progress value={pct(goals.chapter.progress)} className="h-2.5" />
          </div>

          {/* Split disclosure removed (ledger #20): the bar now shows NET money
              that actually reaches the headline entity, so the figure is literally
              true and needs no disclosure at the purchase moment. */}

          {/* Distributor sub-goal — avatar/initials + "Supporting [Name]'s drive"
              + their own mini progress bar and raised/goal. */}
          {goals.distributor && distributorName ? (
            <div className="flex items-start gap-2.5">
              <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold">
                {initialsOf(distributorName)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    Supporting{' '}
                    <b className="font-extrabold">{distributorName}</b>&apos;s
                    drive
                  </span>
                  <span className="text-muted-foreground tabular-nums">
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
      ) : null}
    </div>
  );
}
