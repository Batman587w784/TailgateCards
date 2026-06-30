'use client';

import { useCallback, useMemo } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { ColumnDef, SortingState } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/enhanced-data-table';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import type { RedemptionRecord } from '../../_lib/server/merchant-page.loader';

interface RedemptionsTableProps {
  data: RedemptionRecord[];
  pageCount: number;
  totalCount: number;
  currentPage: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function RedemptionsTable({
  data,
  pageCount,
  totalCount,
  currentPage,
  sortBy,
  sortOrder,
}: RedemptionsTableProps) {
  const router = useRouter();
  const pathname = usePathname();

  const columns = useMemo<ColumnDef<RedemptionRecord>[]>(
    () => [
      {
        id: 'card_code',
        header: () => (
          <Trans i18nKey="merchant:table.cardId" defaults="Card ID" />
        ),
        accessorKey: 'card_code',
        cell: ({ row }) => (
          <span className="font-mono text-sm">#{row.original.card_code}</span>
        ),
      },
      {
        id: 'discount_title',
        header: () => (
          <Trans i18nKey="merchant:table.discount" defaults="Discount" />
        ),
        accessorKey: 'discount_title',
        cell: ({ row }) => <span>{row.original.discount_title}</span>,
      },
      {
        id: 'redeemed_at',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            <Trans i18nKey="merchant:table.date" defaults="Date" />
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        accessorKey: 'redeemed_at',
        cell: ({ row }) => {
          const date = new Date(row.original.redeemed_at);
          return (
            <div className="flex flex-col">
              <span>
                {date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="text-muted-foreground text-xs">
                {date.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          );
        },
      },
    ],
    [],
  );

  // Convert URL params to SortingState for the table
  const sorting: SortingState = useMemo(() => {
    if (sortBy) {
      return [{ id: sortBy, desc: sortOrder === 'desc' }];
    }
    return [{ id: 'redeemed_at', desc: true }];
  }, [sortBy, sortOrder]);

  // Handle sorting change from table
  const handleSortingChange = useCallback(
    (newSorting: SortingState) => {
      const params = new URLSearchParams(window.location.search);

      if (newSorting.length > 0) {
        const sort = newSorting[0];
        if (sort) {
          params.set('sortBy', sort.id);
          params.set('sortOrder', sort.desc ? 'desc' : 'asc');
        }
      } else {
        params.delete('sortBy');
        params.delete('sortOrder');
      }

      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  const navigateToPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(window.location.search);
      params.set('page', String(newPage));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  // Generate page numbers to display
  const getPageNumbers = useCallback(() => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 3;

    if (pageCount <= maxVisiblePages + 2) {
      for (let i = 1; i <= pageCount; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(pageCount - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < pageCount - 2) {
        pages.push('ellipsis');
      }

      if (!pages.includes(pageCount)) {
        pages.push(pageCount);
      }
    }

    return pages;
  }, [pageCount, currentPage]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">
          <Trans
            i18nKey="merchant:table.noRedemptions"
            defaults="No redemptions found"
          />
        </p>
      </div>
    );
  }

  const showingStart = (currentPage - 1) * 10 + 1;

  return (
    <div className="flex flex-col">
      <DataTable
        pageSize={10}
        pageIndex={currentPage - 1}
        data={data}
        columns={columns}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        manualSorting={true}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between border-t px-2 py-3">
        <div className="text-muted-foreground text-sm">
          <Trans
            i18nKey="merchant:table.showing"
            defaults="Showing {{start}} of {{total}} redemptions"
            values={{ start: showingStart, total: totalCount }}
          />
        </div>

        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum, index) =>
              pageNum === 'ellipsis' ? (
                <Button
                  key={`ellipsis-${index}`}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? 'outline' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-8 w-8 p-0',
                    pageNum === currentPage && 'border-border',
                  )}
                  onClick={() => navigateToPage(pageNum)}
                >
                  {pageNum}
                </Button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
