import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { DashboardPageHeader } from '../_components/dashboard-page-header';
import { HomeLayoutPageHeader } from '../_components/home-page-header';
import { DiscountsPage } from './_components/discounts-page';
import {
  loadDiscounts,
  loadMerchantsForSelect,
} from './_lib/server/discounts-page.loader';

export const metadata: Metadata = {
  title: 'Discounts Management',
  description: 'Manage discounts for merchants',
};

interface DiscountsRouteProps {
  searchParams: Promise<{
    page?: string;
    query?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function DiscountsRoute({
  searchParams,
}: DiscountsRouteProps) {
  const client = getSupabaseServerClient();
  const isAdmin = await isSuperAdmin(client);

  if (!isAdmin) {
    notFound();
  }

  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);
  const query = params.query ?? '';
  const sortBy = params.sortBy ?? 'created_at';
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as
    | 'asc'
    | 'desc';
  const pageSize = 10;

  const adminClient = getSupabaseServerAdminClient();

  const [discounts, merchants] = await Promise.all([
    loadDiscounts(adminClient, page, pageSize, query),
    loadMerchantsForSelect(adminClient),
  ]);

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader title="Discounts" description="Discounts" />

      <PageBody>
        <DashboardPageHeader title="Discounts" className="mb-6" />
        <DiscountsPage
          data={discounts.data}
          merchants={merchants}
          pageCount={discounts.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          sortBy={sortBy}
          sortOrder={sortOrder}
          totalCount={discounts.count}
        />
      </PageBody>
    </div>
  );
}
