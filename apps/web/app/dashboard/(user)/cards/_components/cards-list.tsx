'use client';

import { useCallback, useMemo, useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { ColumnDef, SortingState } from '@tanstack/react-table';
import { Download, Filter, Loader2, Search } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/enhanced-data-table';
import { Input } from '@kit/ui/input';

import {
  EntityDataTable,
  EntityPagination,
} from '../../entities/_components/entity-data-table';
import { EntityFormModal } from '../../entities/_components/entity-form-modal';
import {
  CardData,
  OrganizationOption,
} from '../../entities/_lib/server/entities-page.loader';
import { useCardsFilters } from '../_lib/hooks/use-cards-filters';
import { exportCardsAction } from '../_lib/server/cards-export-action';
import {
  DB_STATUS_TO_DISPLAY,
  type FilterCategory,
} from '../_lib/types/filter.types';
import { CardsFilterDrawer } from './cards-filter-drawer';
import { CardsFilterButton, CardsFilterContent } from './cards-filter-panel';
import { CreateCardsForm } from './create-cards-form';

interface CardsListProps {
  data: CardData[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  totalCount: number;
  organizations: OrganizationOption[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filterCategories: FilterCategory[];
}

const sortOptions = [
  { value: 'created_at', label: 'Date Created' },
  { value: 'activated_at', label: 'Date Activated' },
];

export function CardsList({
  data,
  pageCount,
  pageSize,
  page,
  query,
  totalCount,
  organizations,
  sortBy,
  sortOrder,
  filterCategories,
}: CardsListProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(query);
  const router = useRouter();
  const pathname = usePathname();
  const columns = useMemo(() => getColumns(), []);
  const { filters, toggleFilter, clearFilters, activeFilterCount, isPending } =
    useCardsFilters();

  const sorting: SortingState = useMemo(() => {
    if (sortBy) {
      return [{ id: sortBy, desc: sortOrder === 'desc' }];
    }
    return [];
  }, [sortBy, sortOrder]);

  const handleSortingChange = useCallback(
    (newSorting: SortingState) => {
      const params = new URLSearchParams(window.location.search);
      if (newSorting.length > 0 && newSorting[0]) {
        params.set('sortBy', newSorting[0].id);
        params.set('sortOrder', newSorting[0].desc ? 'desc' : 'asc');
      } else {
        params.delete('sortBy');
        params.delete('sortOrder');
      }
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(window.location.search);
      if (searchValue) {
        params.set('query', searchValue);
      } else {
        params.delete('query');
      }
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchValue, router, pathname],
  );

  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const allCards = await exportCardsAction({
        query: query || undefined,
        status: filters.status.length
          ? (filters.status as ('active' | 'expired' | 'inactive')[])
          : undefined,
        batch: filters.batch.length ? filters.batch : undefined,
        organization: filters.organization.length
          ? filters.organization
          : undefined,
        distributor: filters.distributor.length
          ? filters.distributor
          : undefined,
        dateCreated: filters.dateCreated.length
          ? filters.dateCreated
          : undefined,
        cardType: filters.cardType.length
          ? (filters.cardType as ('physical' | 'digital')[])
          : undefined,
      });

      if (!allCards || !Array.isArray(allCards) || allCards.length === 0) {
        return;
      }

      const baseUrl = window.location.origin;
      const rows = allCards.map((card) => ({
        'Card ID': card.display_code,
        Type: card.card_type === 'digital' ? 'Digital' : 'Physical',
        'Card Status': DB_STATUS_TO_DISPLAY[card.status] ?? card.status,
        'Batch Name': card.batch_name ?? '',
        Organization: card.organization_name,
        Distributor: card.distributor_name ?? '',
        'Date Created': card.created_at
          ? new Date(card.created_at).toLocaleDateString()
          : '',
        'Date Activated': card.activated_at
          ? new Date(card.activated_at).toLocaleDateString()
          : '',
        'Activation URL': `${baseUrl}/activate/${card.display_code}`,
      }));

      const headers = Object.keys(rows[0] ?? {});
      const csv = [
        headers.join(','),
        ...rows.map((row) =>
          headers
            .map(
              (h) =>
                `"${String(row[h as keyof typeof row] ?? '').replace(/"/g, '""')}"`,
            )
            .join(','),
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cards-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [query, filters]);

  const actionButton = (
    <div className="flex w-full flex-row items-stretch gap-2 sm:w-auto sm:items-center">
      <Button
        variant="outline"
        onClick={handleExportCSV}
        disabled={isExporting || totalCount === 0}
        className="flex-1 sm:w-auto sm:flex-none"
      >
        {isExporting ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-1 h-4 w-4" />
        )}
        {isExporting ? 'Exporting...' : 'Export CSV'}
      </Button>
      <EntityFormModal
        title="Create Cards"
        description="Generate new cards for an organization."
        triggerLabel="Create Cards"
        className="flex-1 sm:flex-none"
      >
        {({ onSuccess }) => (
          <CreateCardsForm
            organizations={organizations}
            onSuccess={onSuccess}
          />
        )}
      </EntityFormModal>
    </div>
  );

  return (
    <>
      {/* Mobile: Action buttons */}
      <div className="mb-2 sm:hidden">{actionButton}</div>

      {/* Mobile: Search + Filter row */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:hidden">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-10"
            />
          </div>
        </form>
        <Button
          variant="outline"
          onClick={() => setFilterDrawerOpen(true)}
          className="w-full gap-2"
        >
          <Filter className="h-4 w-4" />
          Filter
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Mobile: Table */}
      <div className="sm:hidden">
        <div className="overflow-x-auto rounded-t-lg border border-b-0">
          <DataTable
            data={data}
            columns={columns}
            pageIndex={page - 1}
            pageSize={pageSize}
            headerClassName="h-10 [&_th]:px-2"
            sorting={sorting}
            onSortingChange={handleSortingChange}
            manualSorting={true}
          />
        </div>
        <EntityPagination
          page={page}
          pageCount={pageCount}
          totalCount={totalCount}
          title="Cards"
          dataLength={data.length}
        />
      </div>

      {/* Desktop: Data Table */}
      <div className="hidden sm:block">
        <EntityDataTable
          data={data}
          columns={columns}
          pageCount={pageCount}
          pageSize={pageSize}
          page={page}
          title="Cards"
          totalCount={totalCount}
          searchPlaceholder="Search"
          searchQuery={query}
          sortBy={sortBy}
          sortOrder={sortOrder}
          sortOptions={sortOptions}
          isLoading={isPending}
          filterButton={
            <CardsFilterButton
              isOpen={filterPanelOpen}
              onToggle={() => setFilterPanelOpen(!filterPanelOpen)}
              activeFilterCount={activeFilterCount}
            />
          }
          filterContent={
            filterPanelOpen ? (
              <CardsFilterContent
                categories={filterCategories}
                selectedFilters={filters}
                activeFilterCount={activeFilterCount}
                onToggle={toggleFilter}
                onClear={clearFilters}
              />
            ) : null
          }
          actionButton={actionButton}
        />
      </div>

      <CardsFilterDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        categories={filterCategories}
        selectedFilters={filters}
        activeFilterCount={activeFilterCount}
        onToggle={toggleFilter}
        onClear={clearFilters}
      />
    </>
  );
}

const statusConfig: Record<CardData['status'], string> = {
  pending: 'bg-stone-300 text-stone-700',
  paid: 'bg-stone-300 text-stone-700',
  activated: 'bg-green-500 text-white',
  expired: 'bg-red-300 text-red-900',
  cancelled: 'bg-stone-300 text-stone-700',
};

function getColumns(): ColumnDef<CardData>[] {
  return [
    {
      id: 'display_code',
      header: 'Card ID',
      accessorKey: 'display_code',
      cell: ({ row }) => (
        <span className="text-brand text-sm font-normal">
          {row.original.display_code}
        </span>
      ),
    },
    {
      id: 'card_type',
      header: 'Type',
      accessorKey: 'card_type',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.card_type === 'digital' ? 'Digital' : 'Physical',
    },
    {
      id: 'status',
      header: 'Card Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={`border-0 ${statusConfig[row.original.status]}`}
        >
          {DB_STATUS_TO_DISPLAY[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      id: 'batch_name',
      header: 'Batch Name',
      accessorKey: 'batch_name',
      cell: ({ row }) => (
        <span
          className="block max-w-[120px] truncate"
          title={row.original.batch_name ?? '-'}
        >
          {row.original.batch_name ?? '-'}
        </span>
      ),
    },
    {
      id: 'organization_name',
      header: 'Organization',
      accessorKey: 'organization_name',
      cell: ({ row }) => (
        <span
          className="block max-w-[150px] truncate"
          title={row.original.organization_name}
        >
          {row.original.organization_name}
        </span>
      ),
    },
    {
      id: 'distributor_name',
      header: 'Distributor',
      accessorKey: 'distributor_name',
      cell: ({ row }) => (
        <span
          className="block max-w-[120px] truncate"
          title={row.original.distributor_name ?? '-'}
        >
          {row.original.distributor_name ?? '-'}
        </span>
      ),
    },
    {
      id: 'created_at',
      header: 'Date Created',
      accessorKey: 'created_at',
      cell: ({ row }) =>
        row.original.created_at
          ? new Date(row.original.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : 'N/A',
    },
    {
      id: 'activated_at',
      header: 'Date Activated',
      accessorKey: 'activated_at',
      cell: ({ row }) =>
        row.original.activated_at
          ? new Date(row.original.activated_at).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : '-',
    },
  ];
}
