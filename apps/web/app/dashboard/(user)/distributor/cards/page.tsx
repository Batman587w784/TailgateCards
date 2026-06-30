import type { Metadata } from 'next';

import { PageBody } from '@kit/ui/page';

import { DashboardPageHeader } from '../../_components/dashboard-page-header';
import { HomeLayoutPageHeader } from '../../_components/home-page-header';
import { loadUserWorkspace } from '../../_lib/server/load-user-workspace';
import { requireDistributor } from '../../_lib/server/role-guards';
import { SalesList } from './_components/sales-list';
import { ShareSalesLinkButton } from './_components/share-sales-link-button';
import { loadDistributorSales } from './_lib/server/sales-page.loader';
import type {
  SalesCardTypeFilter,
  SalesFilters,
  SalesStatusFilter,
} from './_lib/types/sales-filter.types';

export const metadata: Metadata = {
  title: 'Cards',
  description: 'Manage the cards in your inventory',
};

interface CardsPageProps {
  searchParams: Promise<{
    page?: string;
    query?: string;
    sortBy?: string;
    sortOrder?: string;
    soldFrom?: string;
    soldTo?: string;
    assignedFrom?: string;
    assignedTo?: string;
    cardType?: string;
    status?: string;
  }>;
}

function parseCardType(value: string | undefined): SalesCardTypeFilter {
  return value === 'physical' || value === 'digital' ? value : 'all';
}

function parseStatus(value: string | undefined): SalesStatusFilter {
  return value === 'active' || value === 'inactive' ? value : 'all';
}

export default async function CardsPage({ searchParams }: CardsPageProps) {
  await requireDistributor();

  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);
  const query = params.query ?? '';
  const sortBy = params.sortBy;
  const sortOrder = (params.sortOrder as 'asc' | 'desc') ?? 'desc';
  const cardType = parseCardType(params.cardType);
  const status = parseStatus(params.status);
  const pageSize = 10;

  const filters: SalesFilters = {
    soldFrom: params.soldFrom || null,
    soldTo: params.soldTo || null,
    assignedFrom: params.assignedFrom || null,
    assignedTo: params.assignedTo || null,
    cardType,
    status,
    query: query || null,
  };

  const [sales, workspace] = await Promise.all([
    loadDistributorSales({
      page,
      pageSize,
      query,
      sortBy,
      sortOrder,
      filters,
    }),
    loadUserWorkspace(),
  ]);

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader title="Cards" description="Cards" />

      <PageBody>
        <div className="mb-6 flex items-center justify-between gap-4">
          <DashboardPageHeader title="Cards" />
          <ShareSalesLinkButton shareSlug={workspace.distributorShareSlug} />
        </div>
        <SalesList
          data={sales.data}
          pageCount={sales.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          totalCount={sales.count}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </PageBody>
    </div>
  );
}
