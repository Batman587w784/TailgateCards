import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { Progress } from '@kit/ui/progress';

import { formatUsdFromCents } from '~/lib/currency';
import { getHierarchyLabels, type NamingPreset } from '~/lib/naming';

import { ShareButton } from './share-button';

export interface PublicRow {
  rank: number;
  label: string;
  cards_sold: number;
  dollars_raised_cents: number;
  goal_progress: number | null;
}

export interface PublicLeaderboardProps {
  campusName: string;
  namingPreset: NamingPreset;
  totalRaisedCents: number;
  totalCardsSold: number;
  chapterCount: number;
  campusGoalProgress: number | null;
  chapters: PublicRow[];
  members: PublicRow[];
}

function Board({ title, description, rows }: { title: string; description: string; rows: PublicRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No standings yet.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((row) => (
              <li
                key={`${row.rank}-${row.label}`}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="text-muted-foreground w-7 text-sm font-semibold tabular-nums">
                  #{row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {row.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatUsdFromCents(row.dollars_raised_cents)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {row.cards_sold} sold
                    </span>
                    {row.goal_progress !== null &&
                    row.goal_progress !== undefined ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Progress
                          value={Math.min(100, Math.round(row.goal_progress * 100))}
                          className="h-2 flex-1"
                        />
                        <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                          {Math.round(row.goal_progress * 100)}%
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function PublicLeaderboard(props: PublicLeaderboardProps) {
  const labels = getHierarchyLabels(props.namingPreset);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">{props.campusName}</p>
          <h1 className="text-4xl font-bold tracking-tight">
            {formatUsdFromCents(props.totalRaisedCents)}
          </h1>
          <p className="text-muted-foreground text-sm">
            raised · {props.totalCardsSold} cards sold across{' '}
            {props.chapterCount} {labels.organization.plural.toLowerCase()}
          </p>
        </div>
        <ShareButton title={`${props.campusName} leaderboard`} />
      </div>

      {props.campusGoalProgress !== null &&
      props.campusGoalProgress !== undefined ? (
        <Progress
          value={Math.min(100, Math.round(props.campusGoalProgress * 100))}
          className="h-2.5"
        />
      ) : null}

      <Board
        title={`${labels.organization.singular} standings`}
        description={`${labels.organization.plural} ranked by sales`}
        rows={props.chapters}
      />

      <Board
        title={`${labels.member.singular} standings`}
        description={`Top ${labels.member.plural.toLowerCase()} across ${props.campusName}`}
        rows={props.members}
      />

      <p className="text-muted-foreground text-center text-xs">
        Standings update as cards are sold.
      </p>
    </div>
  );
}
