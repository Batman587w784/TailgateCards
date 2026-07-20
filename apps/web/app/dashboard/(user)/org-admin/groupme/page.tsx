import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { HomeLayoutPageHeader } from '../../_components/home-page-header';
import {
  getUserOrganizationId,
  requireOrgAdmin,
} from '../../_lib/server/role-guards';
import { GroupMeConnect } from './_components/groupme-connect';
import { loadGroupMeStatus } from './_lib/server/groupme-page.loader';

export const metadata: Metadata = {
  title: 'GroupMe',
  description: 'Auto-post your chapter’s standings to GroupMe',
};

interface GroupMeRouteProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function GroupMeRoute({
  searchParams,
}: GroupMeRouteProps) {
  await requireOrgAdmin();

  const orgId = await getUserOrganizationId();
  if (!orgId) notFound();

  const client = getSupabaseServerClient();
  const [status, params] = await Promise.all([
    loadGroupMeStatus(client, orgId),
    searchParams,
  ]);

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader title="GroupMe" description="GroupMe standings" />

      <PageBody>
        <GroupMeConnect status={status} error={params.error} />
      </PageBody>
    </div>
  );
}
