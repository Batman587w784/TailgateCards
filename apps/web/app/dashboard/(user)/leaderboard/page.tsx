import type { Metadata } from 'next';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { HomeLayoutPageHeader } from '../_components/home-page-header';
import { requireDistributor } from '../_lib/server/role-guards';
import { MemberLeaderboard } from './_components/member-leaderboard';
import { loadMemberLeaderboard } from './_lib/server/leaderboard-page.loader';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Campus standings and goals',
};

async function LeaderboardPage() {
  await requireDistributor();

  const client = getSupabaseServerClient();
  const data = await loadMemberLeaderboard(client);

  return (
    <>
      <HomeLayoutPageHeader
        title="Leaderboard"
        description="Live campus standings & goals"
      />

      <PageBody>
        <MemberLeaderboard data={data} />
      </PageBody>
    </>
  );
}

export default withI18n(LeaderboardPage);
