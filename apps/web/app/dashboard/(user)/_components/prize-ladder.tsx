'use client';

import { useQuery } from '@tanstack/react-query';

import { CalendarClock, Check, Lock, Trophy } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Progress } from '@kit/ui/progress';
import { cn } from '@kit/ui/utils';

import { parseCompetitionWindow } from '~/lib/competition';

interface LadderTier {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  threshold_cards: number;
}

interface DistrictLadder {
  district_name: string | null;
  fundraiser_enabled: boolean;
  competition_start: string | null;
  competition_days: number | null;
  total_cards: number;
  tiers: LadderTier[];
  chapter_prize: string | null;
  individual_prize: string | null;
}

function pct(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function PrizeLadder({ districtId }: { districtId: string }) {
  const supabase = useSupabase();

  const { data } = useQuery({
    queryKey: ['district-ladder', districtId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_district_ladder', {
        p_district_id: districtId,
      });
      if (error) throw error;
      return (data as unknown as DistrictLadder | null) ?? null;
    },
  });

  if (!data || !data.fundraiser_enabled || data.tiers.length === 0) {
    return null;
  }

  const total = data.total_cards;
  const tiers = data.tiers; // ascending by threshold
  const nextTier = tiers.find((t) => total < t.threshold_cards) ?? null;
  const prevThreshold = tiers.reduce(
    (acc, t) => (t.threshold_cards <= total ? t.threshold_cards : acc),
    0,
  );
  const barPct = nextTier
    ? pct(
        ((total - prevThreshold) /
          Math.max(1, nextTier.threshold_cards - prevThreshold)) *
          100,
      )
    : 100;

  const window = parseCompetitionWindow({
    competition_start: data.competition_start,
    competition_days: data.competition_days,
  });

  return (
    <div className="bg-sidebar flex flex-col gap-4 rounded-xl border p-5">
      {/* Header: what we're rowing toward + the countdown (§14). */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="text-brand h-5 w-5" />
          <p className="text-sm font-bold">Chapter fundraiser</p>
        </div>
        {window && !window.isClosed ? (
          <span className="text-muted-foreground flex items-center gap-1 text-xs font-semibold">
            <CalendarClock className="h-3.5 w-3.5" />
            {window.daysLeft} {window.daysLeft === 1 ? 'day' : 'days'} left
          </span>
        ) : window?.isClosed ? (
          <span className="text-muted-foreground text-xs font-semibold">
            Competition closed
          </span>
        ) : null}
      </div>

      {/* Next unlock — show the dream (§1). */}
      {nextTier ? (
        <div className="flex items-center gap-4">
          {nextTier.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nextTier.image_url}
              alt={nextTier.name}
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="bg-brand/10 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg">
              <Trophy className="text-brand h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Next unlock
            </p>
            <p className="truncate text-base font-extrabold">{nextTier.name}</p>
            <p className="text-muted-foreground text-xs">
              {(nextTier.threshold_cards - total).toLocaleString()} cards to go
              · {total.toLocaleString()} of{' '}
              {nextTier.threshold_cards.toLocaleString()}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm font-semibold text-green-600">
          Every prize unlocked — {total.toLocaleString()} cards and counting!
        </p>
      )}

      <Progress value={barPct} className="h-2.5" />

      {/* The full ladder — checkmarks as thresholds fall, next highlighted. */}
      <ul className="flex flex-col">
        {tiers.map((tier) => {
          const reached = total >= tier.threshold_cards;
          const isNext = nextTier?.id === tier.id;

          return (
            <li
              key={tier.id}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-1.5',
                isNext && 'bg-brand/5 ring-brand/30 ring-1',
              )}
            >
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  reached
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {reached ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-sm',
                    isNext ? 'font-bold' : 'font-medium',
                  )}
                >
                  {tier.name}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {tier.threshold_cards.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
