import type { Metadata } from 'next';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { PageBody } from '@kit/ui/page';

import { listGroups } from '~/lib/server/groupme-api';
import {
  GROUPME_PENDING_COOKIE,
  readPending,
} from '~/lib/server/groupme-oauth';

import { HomeLayoutPageHeader } from '../../../_components/home-page-header';
import { requireOrgAdmin } from '../../../_lib/server/role-guards';
import { GroupPicker } from './_components/group-picker';

export const metadata: Metadata = {
  title: 'Choose a GroupMe group',
  description: 'Pick the group Tailgate should post standings to',
};

const MANAGE_PATH = '/dashboard/org-admin/groupme';

export default async function GroupMeSelectRoute() {
  await requireOrgAdmin();

  const cookieStore = await cookies();
  const pending = readPending(cookieStore.get(GROUPME_PENDING_COOKIE)?.value);
  if (!pending) redirect(`${MANAGE_PATH}?error=expired`);

  const admin = getSupabaseServerAdminClient();
  const { data: token } = await admin.rpc('groupme_read_token', {
    p_secret_id: pending.secretId,
  });
  if (!token) redirect(`${MANAGE_PATH}?error=expired`);

  const groups = await listGroups(token);

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader
        title="Connect GroupMe"
        description="Choose a group"
      />

      <PageBody>
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>Which group should Tailgate post to?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              We&apos;ll add a Tailgate bot to the group you pick and post the
              first standings right away.
            </p>
            <GroupPicker groups={groups} />
          </CardContent>
        </Card>
      </PageBody>
    </div>
  );
}
