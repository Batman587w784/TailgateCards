import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { DashboardPageHeader } from '../../_components/dashboard-page-header';
import { HomeLayoutPageHeader } from '../../_components/home-page-header';
import {
  getUserOrganizationId,
  requireOrgAdmin,
} from '../../_lib/server/role-guards';
import { loadUnassignedCardCount } from '../cards/_lib/server/cards-page.loader';
import { DistributorsPage } from './_components/distributors-page';
import {
  loadDistributorsForSelect,
  loadOrgDistributors,
} from './_lib/server/distributors-page.loader';

export const metadata: Metadata = {
  title: 'Distributors',
  description: 'Manage distributors in your organization',
};

interface DistributorsRouteProps {
  searchParams: Promise<{
    page?: string;
    query?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function DistributorsRoute({
  searchParams,
}: DistributorsRouteProps) {
  await requireOrgAdmin();

  const client = getSupabaseServerClient();
  const orgId = await getUserOrganizationId();

  if (!orgId) {
    notFound();
  }

  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);
  const query = params.query ?? '';
  const sortBy =
    params.sortBy === 'name' || params.sortBy === 'created_at'
      ? params.sortBy
      : undefined;
  const sortOrder =
    params.sortOrder === 'asc' || params.sortOrder === 'desc'
      ? params.sortOrder
      : 'desc';
  const pageSize = 10;

  const [distributors, orgProfile, distributorOptions, unassignedCardCount] =
    await Promise.all([
      loadOrgDistributors(
        client,
        orgId,
        page,
        pageSize,
        query,
        sortBy,
        sortOrder,
      ),
      client
        .from('organization_profiles')
        .select('organization_name')
        .eq('account_id', orgId)
        .single(),
      loadDistributorsForSelect(client, orgId),
      loadUnassignedCardCount(client, orgId),
    ]);

  const organizationName = orgProfile.data?.organization_name ?? undefined;

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader title="Distributors" description="Distributors" />

      <PageBody>
        <DashboardPageHeader
          subtitle={organizationName}
          title="Distributors"
          className="mb-6"
        />
        <DistributorsPage
          data={distributors.data}
          pageCount={distributors.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          totalCount={distributors.count}
          sortBy={sortBy}
          sortOrder={sortOrder}
          distributorOptions={distributorOptions}
          unassignedCardCount={unassignedCardCount}
        />
      </PageBody>
    </div>
  );
}
