import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { DashboardPageHeader } from '../_components/dashboard-page-header';
import { HomeLayoutPageHeader } from '../_components/home-page-header';
import {
  loadBatchesForFilter,
  loadCardDatesForFilter,
  loadCards,
  loadDistributorsForFilter,
  loadOrganizationsForSelect,
} from '../entities/_lib/server/entities-page.loader';
import { CardsList } from './_components/cards-list';
import {
  CARD_TYPE_FILTER_OPTIONS,
  type FilterCategory,
  STATUS_FILTER_OPTIONS,
} from './_lib/types/filter.types';

export const metadata: Metadata = {
  title: 'Cards Management',
};

interface CardsPageProps {
  searchParams: Promise<{
    page?: string;
    query?: string;
    sortBy?: string;
    sortOrder?: string;
    status?: string | string[];
    batch?: string | string[];
    organization?: string | string[];
    distributor?: string | string[];
    dateCreated?: string | string[];
    cardType?: string | string[];
  }>;
}

function parseFilterParam(param?: string | string[]): string[] {
  if (!param) return [];
  if (Array.isArray(param)) {
    return param.flatMap((p) => p.split(','));
  }
  return param.split(',');
}

export default async function CardsPage({ searchParams }: CardsPageProps) {
  const client = getSupabaseServerClient();
  const isAdmin = await isSuperAdmin(client);

  if (!isAdmin) {
    notFound();
  }

  const params = await searchParams;
  const page = parseInt(params.page ?? '1', 10);
  const query = params.query ?? '';
  const sortBy = params.sortBy;
  const sortOrder = (params.sortOrder as 'asc' | 'desc') ?? 'desc';
  const pageSize = 10;

  // Parse filter params
  const filters = {
    status: parseFilterParam(params.status),
    batch: parseFilterParam(params.batch),
    organization: parseFilterParam(params.organization),
    distributor: parseFilterParam(params.distributor),
    dateCreated: parseFilterParam(params.dateCreated),
    cardType: parseFilterParam(params.cardType),
  };

  const adminClient = getSupabaseServerAdminClient();

  // Load all data in parallel
  const [cards, organizationsForSelect, batches, distributors, cardDates] =
    await Promise.all([
      loadCards(
        adminClient,
        page,
        pageSize,
        query,
        undefined,
        sortBy,
        sortOrder,
        filters,
      ),
      loadOrganizationsForSelect(adminClient),
      loadBatchesForFilter(adminClient),
      loadDistributorsForFilter(adminClient),
      loadCardDatesForFilter(adminClient),
    ]);

  // Build filter categories
  const filterCategories: FilterCategory[] = [
    {
      id: 'status',
      label: 'Status',
      options: STATUS_FILTER_OPTIONS,
    },
    {
      id: 'cardType',
      label: 'Type',
      options: CARD_TYPE_FILTER_OPTIONS,
    },
    {
      id: 'batch',
      label: 'Batch',
      options: batches.map((b) => ({ id: b.id, label: b.name })),
    },
    {
      id: 'organization',
      label: 'Organization',
      options: organizationsForSelect.map((org) => ({
        id: org.id,
        label: org.name,
      })),
    },
    {
      id: 'distributor',
      label: 'Distributor',
      options: distributors.map((d) => ({ id: d.id, label: d.name })),
    },
    {
      id: 'dateCreated',
      label: 'Date Created',
      options: cardDates.map((d) => ({ id: d.id, label: d.label })),
    },
  ];

  return (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader title="Cards" description="Cards" />

      <PageBody>
        <DashboardPageHeader title="Cards" className="mb-6" />
        <CardsList
          data={cards.data}
          pageCount={cards.pageCount}
          pageSize={pageSize}
          page={page}
          query={query}
          totalCount={cards.count}
          organizations={organizationsForSelect}
          sortBy={sortBy}
          sortOrder={sortOrder}
          filterCategories={filterCategories}
        />
      </PageBody>
    </div>
  );
}
