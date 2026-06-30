import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { DashboardPageHeader } from '../_components/dashboard-page-header';
import { HomeLayoutPageHeader } from '../_components/home-page-header';
import { PaymentsPage } from './_components/payments-page';
import {
  type SortColumn,
  loadPayments,
  loadPaymentsStats,
} from './_lib/server/payments-page.loader';

export const metadata: Metadata = {
  title: 'Payments',
  description: 'View and manage payment transactions',
};

const VALID_SORT_COLUMNS: SortColumn[] = [
  'date',
  'amount',
  'status',
  'cardholder_email',
  'organization_name',
];

interface PaymentsRouteProps {
  searchParams: Promise<{
    page?: string;
    query?: string;
    sortBy?: string;
    sortOrder?: string;
    status?: string;
  }>;
}

export default async function PaymentsRoute({
  searchParams,
}: PaymentsRouteProps) {
  const client = getSupabaseServerClient();
  const isAdmin = await isSuperAdmin(client);

  if (!isAdmin) {
    notFound();
  }

  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);
  const query = params.query ?? '';
  const sortColumn = VALID_SORT_COLUMNS.includes(params.sortBy as SortColumn)
    ? (params.sortBy as SortColumn)
    : 'date';
  const sortDirection = params.sortOrder === 'asc' ? 'asc' : 'desc';
  const status = params.status as 'successful' | 'failed' | undefined;
  const pageSize = 10;

  const adminClient = getSupabaseServerAdminClient();

  const [stats, payments] = await Promise.all([
    loadPaymentsStats(adminClient),
    loadPayments(adminClient, page, pageSize, query, sortColumn, sortDirection),
  ]);

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader title="Payments" description="Payments" />

      <PageBody>
        <DashboardPageHeader title="Payments" className="mb-6" />
        <PaymentsPage
          stats={stats}
          data={payments.data}
          pageCount={payments.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          status={status}
          totalCount={payments.count}
        />
      </PageBody>
    </div>
  );
}
