import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { HomeLayoutPageHeader } from '../_components/home-page-header';
import { getPlatformRole } from '../_lib/server/role-guards';
import { MemberLeaderboard } from './_components/member-leaderboard';
import { loadMemberLeaderboard } from './_lib/server/leaderboard-page.loader';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Campus standings and goals',
};

const ALLOWED_ROLES = ['distributor', 'org_admin', 'district_admin'];

async function LeaderboardPage() {
  const client = getSupabaseServerClient();

  // P0-4: visible to members, org admins, district admins, and super-admin.
  const admin = await isSuperAdmin(client);

  if (!admin) {
    const role = await getPlatformRole(client);

    if (!ALLOWED_ROLES.includes(role)) {
      notFound();
    }
  }

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
