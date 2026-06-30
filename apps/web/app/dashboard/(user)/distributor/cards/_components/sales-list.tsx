'use client';

import { useMemo, useState } from 'react';

import { ColumnDef } from '@tanstack/react-table';
import { Filter } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';

import {
  EntityDataTable,
  EntityPagination,
} from '../../../entities/_components/entity-data-table';
import { useSalesFilters } from '../_lib/hooks/use-sales-filters';
import {
  DB_STATUS_TO_DISPLAY,
  type SaleData,
} from '../_lib/types/sales-filter.types';
import { SaleTile } from './sale-tile';
import { SalesFilterButton, SalesFilterContent } from './sales-filter-panel';
import { SalesMobileFilterSection } from './sales-mobile-filter-section';

interface SalesListProps {
  data: SaleData[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  totalCount: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const sortOptions = [{ value: 'activated_at', label: 'Date Sold' }];

export function SalesList({
  data,
  pageCount,
  pageSize,
  page,
  query,
  totalCount,
  sortBy,
  sortOrder,
}: SalesListProps) {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const columns = useMemo(() => getColumns(), []);
  const {
    filters,
    setDateFilter,
    setCardType,
    setStatus,
    applyFilters,
    clearFilters,
    activeFilterCount,
    isPending,
  } = useSalesFilters();

  return (
    <EntityDataTable
      data={data}
      columns={columns}
      pageCount={pageCount}
      pageSize={pageSize}
      page={page}
      title="Cards"
      totalCount={totalCount}
      searchPlaceholder="Search by Card ID or Organization"
      searchQuery={query}
      sortBy={sortBy}
      sortOrder={sortOrder}
      sortOptions={sortOptions}
      isLoading={isPending}
      filterButton={
        <SalesFilterButton
          isOpen={filterPanelOpen}
          onToggle={() => setFilterPanelOpen(!filterPanelOpen)}
          activeFilterCount={activeFilterCount}
        />
      }
      filterContent={
        filterPanelOpen ? (
          <SalesFilterContent
            filters={filters}
            activeFilterCount={activeFilterCount}
            onDateChange={setDateFilter}
            onStatusChange={setStatus}
            onCardTypeChange={setCardType}
            onApply={applyFilters}
            onClear={clearFilters}
          />
        ) : null
      }
      mobileFilterButton={
        <Button
          variant="outline"
          onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
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
      }
      mobileFilterContent={
        <SalesMobileFilterSection
          isOpen={mobileFilterOpen}
          filters={filters}
          onDateChange={setDateFilter}
          onStatusChange={setStatus}
          onCardTypeChange={setCardType}
          onApply={applyFilters}
          onClear={clearFilters}
        />
      }
      mobileListComponent={
        <MobileSalesList
          data={data}
          page={page}
          pageCount={pageCount}
          totalCount={totalCount}
        />
      }
    />
  );
}

function MobileSalesList({
  data,
  page,
  pageCount,
  totalCount,
}: {
  data: SaleData[];
  page: number;
  pageCount: number;
  totalCount: number;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No cards found
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((sale) => (
        <div
          key={sale.id}
          className="rounded-lg border bg-white p-4"
          style={{ boxShadow: '0px 1px 2px 0px #0000000D' }}
        >
          <SaleTile sale={sale} />
        </div>
      ))}

      <EntityPagination
        page={page}
        pageCount={pageCount}
        totalCount={totalCount}
        title="Cards"
        dataLength={data.length}
      />
    </div>
  );
}

function getColumns(): ColumnDef<SaleData>[] {
  return [
    {
      id: 'display_code',
      header: 'Card ID',
      accessorKey: 'display_code',
      enableSorting: false,
      cell: ({ row }) => row.original.display_code,
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
      header: 'Status',
      accessorKey: 'status',
      enableSorting: false,
      cell: ({ row }) => {
        const display = DB_STATUS_TO_DISPLAY[row.original.status] ?? 'Inactive';
        return (
          <Badge
            variant="outline"
            className={
              display === 'Active'
                ? 'border-0 bg-green-100 text-green-800'
                : 'border-0 bg-gray-100 text-gray-700'
            }
          >
            {display}
          </Badge>
        );
      },
    },
    {
      id: 'activated_at',
      header: 'Date Sold',
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
    {
      id: 'assigned_at',
      header: 'Date Assigned',
      accessorKey: 'assigned_at',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.assigned_at
          ? new Date(row.original.assigned_at).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : '-',
    },
  ];
}
