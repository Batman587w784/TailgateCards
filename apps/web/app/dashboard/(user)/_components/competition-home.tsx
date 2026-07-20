import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import type { MemberLeaderboardData } from '../leaderboard/_lib/server/leaderboard-page.loader';
import { ChapterAvatar } from './chapter-avatar';
import { PrizeLadder } from './prize-ladder';
import { ShareButton } from './share-button';

interface CompetitionHomeProps {
  data: MemberLeaderboardData;
  role: 'distributor' | 'org_admin';
  /** The viewer's chapter (org) account id, to highlight + read "my" standing. */
  viewerOrgId: string | null;
  /** Absolute buy link — member's personal link, or the chapter link for admins. */
  shareUrl: string;
  /** Absolute invite link (org-admin primary action). */
  inviteUrl?: string;
}

/**
 * M2.5-e — the one-screen competition home (§7): three panels (prize ladder +
 * countdown · chapter standings vs rivals · my number) and a share/invite
 * action. Renders nothing when there's no campus context.
 */
export function CompetitionHome({
  data,
  role,
  viewerOrgId,
  shareUrl,
  inviteUrl,
}: CompetitionHomeProps) {
  const { summary, chapters, members, position, nextPrize } = data;

  if (!summary) {
    return null;
  }

  const myChapter =
    chapters.find((c) => c.org_account_id === viewerOrgId) ?? null;
  const chapterName = myChapter?.chapter_name ?? summary.campus_name;

  // Dynamic share copy from live standing (degrades gracefully).
  const gap = (members[0]?.cards_sold ?? 0) - (position?.cards_sold ?? 0);
  let line: string;
  if (role === 'distributor' && position) {
    line =
      gap > 0
        ? `I'm ${gap} ${gap === 1 ? 'card' : 'cards'} from #1 for ${chapterName}`
        : `We're #1 for ${chapterName} — help us hold it`;
  } else {
    line = `Support ${chapterName}`;
  }
  line += nextPrize
    ? ` — grab a card and help us hit ${nextPrize}`
    : ' — grab a card to help us win';

  const myCards =
    role === 'distributor'
      ? (position?.cards_sold ?? 0)
      : (myChapter?.cards_sold ?? 0);
  const myRank =
    role === 'distributor' ? position?.chapter_rank : myChapter?.rank;

  return (
    <div className="flex flex-col gap-4">
      {/* Panel 1 — district collective bar + next prize + countdown. */}
      <PrizeLadder districtId={summary.district_id} />

      {/* Panel 2 — chapter standings vs rivals. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Chapter standings</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {chapters.slice(0, 5).map((c) => (
              <li
                key={c.org_account_id}
                className={`flex items-center gap-3 py-2 ${
                  c.org_account_id === viewerOrgId
                    ? 'bg-muted/50 -mx-2 rounded-md px-2'
                    : ''
                }`}
              >
                <span className="text-muted-foreground w-6 text-sm font-semibold tabular-nums">
                  #{c.rank}
                </span>
                <ChapterAvatar
                  name={c.chapter_name}
                  logoUrl={c.logo_url}
                  className="h-7 w-7"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {c.chapter_name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {c.cards_sold} sold
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Panel 3 — my number. */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              {role === 'distributor' ? 'My sales' : 'Our chapter'}
            </p>
            <p className="text-2xl font-extrabold">
              {myCards.toLocaleString()}{' '}
              <span className="text-muted-foreground text-sm font-medium">
                cards
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Rank
            </p>
            <p className="text-2xl font-extrabold">
              #{myRank ?? '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action — SHARE (member) or Invite + Share (org-admin, §7). */}
      {role === 'distributor' ? (
        <ShareButton text={line} url={shareUrl} label="Share my link" />
      ) : (
        <div className="flex flex-col gap-2">
          {inviteUrl ? (
            <Button
              asChild
              size="lg"
              className="bg-brand text-brand-foreground hover:bg-brand/90 w-full"
            >
              <Link href={inviteUrl}>Invite members to my chapter</Link>
            </Button>
          ) : null}
          <ShareButton
            text={`Support ${chapterName}${nextPrize ? ` — help us hit ${nextPrize}` : ''}`}
            url={shareUrl}
            label="Share chapter buy link"
          />
        </div>
      )}
    </div>
  );
}
