import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { DashboardPageHeader } from '../../_components/dashboard-page-header';
import { HomeLayoutPageHeader } from '../../_components/home-page-header';
import { loadUserWorkspace } from '../../_lib/server/load-user-workspace';
import {
  getUserOrganizationId,
  requireOrgAdmin,
} from '../../_lib/server/role-guards';
import { CardsPage } from './_components/cards-page';
import { ShareOrgSalesLinkButton } from './_components/share-org-sales-link-button';
import {
  loadBatchPrefixes,
  loadDistributorsForFilter,
  loadOrgCards,
  loadUnassignedCardCount,
} from './_lib/server/cards-page.loader';

export const metadata: Metadata = {
  title: 'Cards',
  description: 'Manage cards in your organization',
};

interface CardsRouteProps {
  searchParams: Promise<{
    page?: string;
    query?: string;
    sortBy?: string;
    sortOrder?: string;
    statuses?: string;
    distributors?: string;
    batchPrefixes?: string;
    createdFrom?: string;
    createdTo?: string;
    openBulkAssign?: string;
  }>;
}

export default async function CardsRoute({ searchParams }: CardsRouteProps) {
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
    params.sortBy === 'display_code' || params.sortBy === 'created_at'
      ? params.sortBy
      : undefined;
  const sortOrder =
    params.sortOrder === 'asc' || params.sortOrder === 'desc'
      ? params.sortOrder
      : 'desc';
  const pageSize = 10;

  // Parse filters from URL params
  const filters = {
    statuses: params.statuses?.split(',').filter(Boolean) ?? [],
    distributors: params.distributors?.split(',').filter(Boolean) ?? [],
    batchPrefixes: params.batchPrefixes?.split(',').filter(Boolean) ?? [],
    createdFrom: params.createdFrom ?? null,
    createdTo: params.createdTo ?? null,
  };

  const [
    cards,
    distributors,
    batchPrefixes,
    orgProfile,
    unassignedCardCount,
    workspace,
  ] = await Promise.all([
    loadOrgCards(
      client,
      orgId,
      page,
      pageSize,
      query,
      sortBy,
      sortOrder,
      filters,
    ),
    loadDistributorsForFilter(client, orgId),
    loadBatchPrefixes(client, orgId),
    client
      .from('organization_profiles')
      .select('organization_name')
      .eq('account_id', orgId)
      .single(),
    loadUnassignedCardCount(client, orgId),
    loadUserWorkspace(),
  ]);

  const organizationName = orgProfile.data?.organization_name ?? undefined;

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader title="Cards" description="Manage cards" />

      <PageBody>
        <div className="mb-6 flex items-center justify-between gap-4">
          <DashboardPageHeader subtitle={organizationName} title="Cards" />
          <ShareOrgSalesLinkButton shareSlug={workspace.orgShareSlug} />
        </div>
        <CardsPage
          data={cards.data}
          pageCount={cards.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          totalCount={cards.count}
          sortBy={sortBy}
          sortOrder={sortOrder}
          distributors={distributors}
          batchPrefixes={batchPrefixes}
          unassignedCardCount={unassignedCardCount}
          openBulkAssign={params.openBulkAssign === 'true'}
        />
      </PageBody>
    </div>
  );
}
