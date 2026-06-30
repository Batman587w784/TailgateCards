'use client';

import { useCallback, useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';

import { CardholderData } from '../_lib/server/entities-page.loader';
import { CardholdersSortDrawer } from './cardholders-sort-drawer';
import { EntityDataTable } from './entity-data-table';
import { CardholderTile } from './tiles/cardholder-tile';

interface CardholdersTabProps {
  data: CardholderData[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  totalCount: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const sortOptions = [
  { value: 'expiry_date', label: 'Expiry Date', orderType: 'date' as const },
  {
    value: 'activation_date',
    label: 'Activation Date',
    orderType: 'date' as const,
  },
  {
    value: 'total_redemptions',
    label: 'Use Count',
    orderType: 'number' as const,
  },
];

export function CardholdersTab({
  data,
  pageCount,
  pageSize,
  page,
  query,
  totalCount,
  sortBy,
  sortOrder,
}: CardholdersTabProps) {
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(query);
  const router = useRouter();
  const pathname = usePathname();

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

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(window.location.search);
      params.set('page', String(newPage));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const mobileListComponent = (
    <MobileCardholdersList
      data={data}
      page={page}
      pageCount={pageCount}
      onPageChange={handlePageChange}
    />
  );

  return (
    <>
      {/* Mobile: Search + Sort controls */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:hidden">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-10"
            />
          </div>
        </form>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setSortDrawerOpen(true)}
        >
          <ArrowUpDown className="h-4 w-4" />
          Sort by
        </Button>
      </div>

      {/* Mobile: List */}
      <div className="sm:hidden">{mobileListComponent}</div>

      {/* Desktop: Data Table */}
      <div className="hidden sm:block">
        <EntityDataTable
          data={data}
          columns={getColumns()}
          pageCount={pageCount}
          pageSize={pageSize}
          page={page}
          title="Cardholders"
          totalCount={totalCount}
          searchPlaceholder="Search"
          searchQuery={query}
          sortBy={sortBy}
          sortOrder={sortOrder}
          sortOptions={sortOptions}
          mobileListComponent={mobileListComponent}
        />
      </div>

      {/* Sort Drawer (Mobile) */}
      <CardholdersSortDrawer
        open={sortDrawerOpen}
        onOpenChange={setSortDrawerOpen}
        currentSortBy={sortBy ?? 'activation_date'}
        currentSortOrder={sortOrder ?? 'desc'}
      />
    </>
  );
}

function MobileCardholdersList({
  data,
  page,
  pageCount,
  onPageChange,
}: {
  data: CardholderData[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No cardholders found
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((cardholder) => (
        <CardholderTile key={cardholder.card_id} cardholder={cardholder} />
      ))}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-1">
          {(() => {
            const pages: React.ReactNode[] = [];
            const currentPage = page;
            const totalPages = pageCount;

            if (currentPage > 3) {
              pages.push(
                <Button
                  key={1}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onPageChange(1)}
                >
                  1
                </Button>,
              );
              if (currentPage > 4) {
                pages.push(
                  <Button
                    key="ellipsis-1"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>,
                );
              }
            }

            const start = Math.max(1, currentPage - 2);
            const end = Math.min(totalPages, currentPage + 2);

            for (let i = start; i <= end; i++) {
              pages.push(
                <Button
                  key={i}
                  variant={currentPage === i ? 'outline' : 'ghost'}
                  size="sm"
                  className={`h-8 w-8 p-0 ${
                    currentPage === i ? 'border-border' : ''
                  }`}
                  onClick={() => onPageChange(i)}
                >
                  {i}
                </Button>,
              );
            }

            if (currentPage < totalPages - 2) {
              if (currentPage < totalPages - 3) {
                pages.push(
                  <Button
                    key="ellipsis-2"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>,
                );
              }
              pages.push(
                <Button
                  key={totalPages}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onPageChange(totalPages)}
                >
                  {totalPages}
                </Button>,
              );
            }

            return pages;
          })()}
        </div>
      )}
    </div>
  );
}

function getColumns(): ColumnDef<CardholderData>[] {
  return [
    {
      id: 'card_id',
      header: 'Card ID',
      accessorKey: 'card_id',
      cell: ({ row }) => row.original.display_code ?? 'N/A',
    },
    {
      id: 'cardholder_name',
      header: 'Cardholder Name',
      accessorKey: 'cardholder_name',
      cell: ({ row }) => row.original.cardholder_name ?? 'Unknown',
    },
    {
      id: 'activation_date',
      header: 'Activation Date',
      accessorKey: 'activation_date',
      cell: ({ row }) =>
        row.original.activation_date
          ? new Date(row.original.activation_date).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : 'N/A',
    },
    {
      id: 'expires_at',
      header: 'Expires',
      accessorKey: 'expires_at',
      cell: ({ row }) =>
        row.original.expires_at
          ? new Date(row.original.expires_at).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : 'N/A',
    },
    {
      id: 'total_redemptions',
      header: 'Use Count',
      accessorKey: 'total_redemptions',
      cell: ({ row }) => row.original.total_redemptions.toLocaleString(),
    },
  ];
}
