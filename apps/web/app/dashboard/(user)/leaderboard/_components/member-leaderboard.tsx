import Link from 'next/link';

import { Trophy } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';

import { formatUsdFromCents } from '~/lib/currency';
import { getHierarchyLabels } from '~/lib/naming';

import type { MemberLeaderboardData } from '../_lib/server/leaderboard-page.loader';

function GoalProgress({ progress }: { progress: number | null }) {
  if (progress === null || progress === undefined) {
    return null;
  }

  const pct = Math.round(progress * 100);

  return (
    <div className="flex items-center gap-2">
      <Progress value={Math.min(100, pct)} className="h-2 flex-1" />
      <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

interface Row {
  rank: number;
  label: string;
  dollars_raised_cents: number;
  cards_sold: number;
  goal_progress: number | null;
  highlight?: boolean;
}

function LeaderboardTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No standings yet.</p>
    );
  }

  return (
    <ul className="flex flex-col divide-y">
      {rows.map((row) => (
        <li
          key={`${row.rank}-${row.label}`}
          className={`flex items-center gap-3 py-2.5 ${row.highlight ? 'bg-muted/50 -mx-2 rounded-md px-2' : ''}`}
        >
          <span className="text-muted-foreground w-7 text-sm font-semibold tabular-nums">
            #{row.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{row.label}</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatUsdFromCents(row.dollars_raised_cents)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {row.cards_sold} sold
              </span>
              <div className="flex-1">
                <GoalProgress progress={row.goal_progress} />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MemberLeaderboard({ data }: { data: MemberLeaderboardData }) {
  const { position, summary, chapters, members, membersScope } = data;

  // No campus context (member whose org isn't in a campus, or an admin with no
  // active campus yet).
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No campus standings yet</CardTitle>
          <CardDescription>
            {position
              ? `Your organization isn't part of a campus competition yet. Your own sales so far: ${formatUsdFromCents(position.dollars_raised_cents)} (${position.cards_sold} sold).`
              : 'There is no active campus to show standings for yet.'}
          </CardDescription>
        </CardHeader>
        {position ? (
          <CardContent>
            <Link href="/join/start" className="text-primary text-sm underline">
              Get started
            </Link>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  const labels = getHierarchyLabels(summary.naming_preset);

  return (
    <div className="flex flex-col gap-6">
      {/* Campus total (+ my rank, members only) */}
      <div className={`grid gap-4 ${position ? 'md:grid-cols-2' : ''}`}>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{summary.campus_name} total raised</CardDescription>
            <CardTitle className="text-3xl">
              {formatUsdFromCents(summary.total_raised_cents)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">
              {summary.total_cards_sold} cards sold across{' '}
              {summary.chapter_count}{' '}
              {labels.organization.plural.toLowerCase()}
            </span>
            <GoalProgress progress={summary.goal_progress} />
          </CardContent>
        </Card>

        {position ? (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Your rank in your{' '}
                {labels.organization.singular.toLowerCase()}
              </CardDescription>
              <CardTitle className="text-3xl">
                #{position.chapter_rank}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="text-muted-foreground text-sm">
                {formatUsdFromCents(position.dollars_raised_cents)} raised ·{' '}
                {position.cards_sold} sold
              </div>
              <GoalProgress progress={position.goal_progress} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Chapter standings (campus) */}
      <Card>
        <CardHeader>
          <CardTitle>{labels.organization.singular} standings</CardTitle>
          <CardDescription>
            {labels.organization.plural} ranked across {summary.campus_name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardTable
            rows={chapters.map((c) => ({
              rank: c.rank,
              label: c.chapter_name,
              dollars_raised_cents: c.dollars_raised_cents,
              cards_sold: c.cards_sold,
              goal_progress: c.goal_progress,
              highlight: c.org_account_id === position?.org_account_id,
            }))}
          />
        </CardContent>
      </Card>

      {/* Member standings — own chapter (member/org-admin) or campus-wide (admin) */}
      <Card>
        <CardHeader>
          <CardTitle>
            {membersScope === 'campus'
              ? `${labels.member.singular} standings`
              : `Your ${labels.organization.singular.toLowerCase()}'s ${labels.member.plural.toLowerCase()}`}
          </CardTitle>
          <CardDescription>
            {membersScope === 'campus'
              ? `${labels.member.plural} ranked across ${summary.campus_name}`
              : `${labels.member.plural} ranked by sales`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardTable
            rows={members.map((m) => ({
              rank: m.rank,
              label: m.display_name,
              dollars_raised_cents: m.dollars_raised_cents,
              cards_sold: m.cards_sold,
              goal_progress: m.goal_progress,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
