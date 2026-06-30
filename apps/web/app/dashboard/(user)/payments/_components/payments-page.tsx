'use client';

import { useCallback } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';

import { EntityDataTable } from '../../entities/_components/entity-data-table';
import type {
  PaymentStats,
  PaymentTransaction,
} from '../_lib/schemas/payment.schema';
import {
  formatCurrency,
  formatDate,
  formatTransactionId,
} from '../_lib/schemas/payment.schema';
import { TransactionTile } from './transaction-tile';

type SortColumn =
  | 'date'
  | 'amount'
  | 'status'
  | 'cardholder_email'
  | 'organization_name';

interface PaymentsPageProps {
  stats: PaymentStats;
  data: PaymentTransaction[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';
  status?: 'successful' | 'failed';
  totalCount: number;
}

const sortOptions = [
  { value: 'date', label: 'Date', orderType: 'date' as const },
];

export function PaymentsPage({
  stats,
  data,
  pageCount,
  pageSize,
  page,
  query,
  sortColumn,
  sortDirection,
  status: _status,
  totalCount,
}: PaymentsPageProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(window.location.search);
      params.set('page', String(newPage));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Desktop: Full Stats Grid */}
      <div className="hidden grid-cols-1 gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Transaction Volume"
          value={formatCurrency(stats.total_volume_cents)}
        />
        <StatCard
          label="Total Revenue Generated"
          value={formatCurrency(stats.revenue_generated_cents)}
        />
        <StatCard
          label="Successful Transactions"
          value={stats.successful_transactions.toLocaleString()}
        />
        <StatCard
          label="Failed Transactions"
          value={stats.failed_transactions.toLocaleString()}
        />
      </div>

      {/* Mobile: Scrollable Stats Cards */}
      <div className="md:hidden">
        <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="min-w-[85%]">
            <StatCard
              label="Total Transaction Volume"
              value={formatCurrency(stats.total_volume_cents)}
            />
          </div>
          <div className="min-w-[85%]">
            <StatCard
              label="Total Revenue Generated"
              value={formatCurrency(stats.revenue_generated_cents)}
            />
          </div>
          <div className="min-w-[85%]">
            <StatCard
              label="Successful Transactions"
              value={stats.successful_transactions.toLocaleString()}
            />
          </div>
          <div className="min-w-[85%]">
            <StatCard
              label="Failed Transactions"
              value={stats.failed_transactions.toLocaleString()}
            />
          </div>
        </div>
      </div>

      {/* EntityDataTable - handles both mobile and desktop */}
      <EntityDataTable
        data={data}
        columns={columns}
        pageCount={pageCount}
        pageSize={pageSize}
        page={page}
        title="Transactions"
        totalCount={totalCount}
        searchPlaceholder="Search"
        searchQuery={query}
        sortBy={sortColumn}
        sortOrder={sortDirection}
        sortOptions={sortOptions}
        mobileListComponent={
          <div>
            {data.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No transactions found
              </p>
            ) : (
              <div className="space-y-3">
                {data.map((transaction) => (
                  <TransactionTile
                    key={transaction.transaction_id}
                    transaction={transaction}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2">
                {(() => {
                  const pages: React.ReactNode[] = [];
                  const currentPage = page;
                  const totalPages = pageCount;

                  // Show first page if not in window
                  if (currentPage > 3) {
                    pages.push(
                      <Button
                        key={1}
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePageChange(1)}
                      >
                        1
                      </Button>,
                    );
                    if (currentPage > 4) {
                      pages.push(
                        <span
                          key="ellipsis-1"
                          className="text-muted-foreground px-1"
                        >
                          ...
                        </span>,
                      );
                    }
                  }

                  // Show pages around current page
                  const start = Math.max(1, currentPage - 2);
                  const end = Math.min(totalPages, currentPage + 2);

                  for (let i = start; i <= end; i++) {
                    pages.push(
                      <Button
                        key={i}
                        variant={currentPage === i ? 'outline' : 'ghost'}
                        size="sm"
                        className={
                          currentPage === i ? 'border-primary text-primary' : ''
                        }
                        onClick={() => handlePageChange(i)}
                      >
                        {i}
                      </Button>,
                    );
                  }

                  // Show last page if not in window
                  if (currentPage < totalPages - 2) {
                    if (currentPage < totalPages - 3) {
                      pages.push(
                        <span
                          key="ellipsis-2"
                          className="text-muted-foreground px-1"
                        >
                          ...
                        </span>,
                      );
                    }
                    pages.push(
                      <Button
                        key={totalPages}
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePageChange(totalPages)}
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
        }
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

const columns: ColumnDef<PaymentTransaction>[] = [
  {
    id: 'transaction_id',
    header: 'Transaction ID',
    accessorKey: 'transaction_id',
    enableSorting: false,
    cell: ({ row }) => (
      <span data-test="transaction-id">
        {formatTransactionId(row.original.transaction_id)}
      </span>
    ),
  },
  {
    id: 'card_id',
    header: 'Card ID',
    accessorKey: 'card_id',
    enableSorting: false,
    cell: ({ row }) => <span data-test="card-id">{row.original.card_id}</span>,
  },
  {
    id: 'cardholder_email',
    header: 'Cardholder Email',
    accessorKey: 'cardholder_email',
    enableSorting: false,
    cell: ({ row }) => row.original.cardholder_email ?? '-',
  },
  {
    id: 'organization_name',
    header: 'Organization',
    accessorKey: 'organization_name',
    enableSorting: false,
    cell: ({ row }) => row.original.organization_name ?? '-',
  },
  {
    id: 'amount',
    header: 'Amount',
    accessorKey: 'amount_cents',
    enableSorting: false,
    cell: ({ row }) => formatCurrency(row.original.amount_cents),
  },
  {
    id: 'date',
    header: 'Date',
    accessorKey: 'date',
    enableSorting: true,
    cell: ({ row }) => formatDate(row.original.date),
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    enableSorting: false,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

function StatusBadge({ status }: { status: 'successful' | 'failed' }) {
  if (status === 'successful') {
    return (
      <Badge
        variant="success"
        className="bg-green-500 text-white"
        data-test="payment-status-successful"
      >
        Successful
      </Badge>
    );
  }

  return (
    <Badge
      variant="destructive"
      className="bg-red-800 text-white"
      data-test="payment-status-failed"
    >
      Failed
    </Badge>
  );
}
