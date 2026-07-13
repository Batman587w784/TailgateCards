import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { DashboardPageHeader } from '../_components/dashboard-page-header';
import { HomeLayoutPageHeader } from '../_components/home-page-header';
import { EntitiesTabs } from './_components/entities-tabs';
import {
  loadCardholders,
  loadDistributors,
  loadDistricts,
  loadMerchants,
  loadMerchantsForSelect,
  loadOrganizations,
  loadOrganizationsForSelect,
} from './_lib/server/entities-page.loader';

export const metadata: Metadata = {
  title: 'Users',
};

interface EntitiesPageProps {
  searchParams: Promise<{
    page?: string;
    query?: string;
    tab?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function EntitiesPage({
  searchParams,
}: EntitiesPageProps) {
  const client = getSupabaseServerClient();
  const isAdmin = await isSuperAdmin(client);

  if (!isAdmin) {
    notFound();
  }

  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);
  const query = params.query ?? '';
  const activeTab = params.tab ?? 'organizations';
  const sortBy = params.sortBy;
  const sortOrder = (params.sortOrder as 'asc' | 'desc') ?? 'desc';
  const pageSize = 10;

  const adminClient = getSupabaseServerAdminClient();

  // Load all entities in parallel
  const [
    organizations,
    merchants,
    distributors,
    cardholders,
    districts,
    organizationsForSelect,
    merchantsForSelect,
  ] = await Promise.all([
    loadOrganizations(adminClient, page, pageSize, query, sortBy, sortOrder),
    loadMerchants(adminClient, page, pageSize, query, sortBy, sortOrder),
    loadDistributors(adminClient, page, pageSize, query, sortBy, sortOrder),
    loadCardholders(adminClient, page, pageSize, query, sortBy, sortOrder),
    loadDistricts(adminClient, page, pageSize, query, sortBy, sortOrder),
    loadOrganizationsForSelect(adminClient),
    loadMerchantsForSelect(adminClient),
  ]);

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader title="Users" description="Users" />

      <PageBody>
        <DashboardPageHeader title="Users" className="mb-6" />
        <EntitiesTabs
          organizations={organizations}
          merchants={merchants}
          distributors={distributors}
          cardholders={cardholders}
          districts={districts}
          organizationsForSelect={organizationsForSelect}
          merchantsForSelect={merchantsForSelect}
          page={page}
          pageSize={pageSize}
          query={query}
          activeTab={activeTab}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </PageBody>
    </div>
  );
}
