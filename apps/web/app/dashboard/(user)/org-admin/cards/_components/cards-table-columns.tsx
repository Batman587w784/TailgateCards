'use client';

import { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@kit/ui/badge';
import { Checkbox } from '@kit/ui/checkbox';

import type { OrgCard } from '../_lib/server/cards-page.loader';
import type { DistributorOption } from '../_lib/server/cards-page.loader';
import { AssignDistributorDropdown } from './assign-distributor-dropdown';

function getStatusBadge(status: string) {
  switch (status) {
    case 'activated':
      return (
        <Badge className="border-transparent bg-green-500 text-white">
          Activated
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="border-transparent bg-yellow-500 text-white">
          Pending
        </Badge>
      );
    case 'expired':
      return (
        <Badge className="border-transparent bg-gray-500 text-white">
          Expired
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge className="border-transparent bg-red-500 text-white">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

interface GetColumnsOptions {
  distributors: DistributorOption[];
  selectedCardIds: Set<string>;
  onSelectCard: (cardId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  allSelected: boolean;
  someSelected: boolean;
}

export function getCardsColumns({
  distributors,
  selectedCardIds,
  onSelectCard,
  onSelectAll,
  allSelected,
  someSelected,
}: GetColumnsOptions): ColumnDef<OrgCard>[] {
  return [
    {
      id: 'select',
      header: () => (
        <Checkbox
          checked={allSelected}
          className="data-[state=checked]:bg-brand data-[state=checked]:border-brand"
          onCheckedChange={(checked) => onSelectAll(checked === true)}
          aria-label="Select all"
          data-test="select-all-checkbox"
          {...(someSelected && !allSelected
            ? { 'data-state': 'indeterminate' }
            : {})}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedCardIds.has(row.original.id)}
          className="data-[state=checked]:bg-brand data-[state=checked]:border-brand"
          onCheckedChange={(checked) =>
            onSelectCard(row.original.id, checked === true)
          }
          aria-label={`Select card ${row.original.display_code}`}
          data-test="select-card-checkbox"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
      maxSize: 40,
    },
    {
      id: 'display_code',
      header: 'Card Number',
      accessorKey: 'display_code',
      cell: ({ row }) => (
        <span
          className="text-brand text-sm font-bold"
          data-test="card-code-cell"
        >
          {row.original.display_code}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Card Status',
      accessorKey: 'status',
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      id: 'distributor',
      header: 'Distributor',
      cell: ({ row }) => (
        <span
          className={
            row.original.distributor_name
              ? 'text-sm'
              : 'text-muted-foreground text-sm'
          }
        >
          {row.original.distributor_name ?? 'Unassigned'}
        </span>
      ),
    },
    {
      id: 'assigned_at',
      header: 'Date Assigned',
      accessorKey: 'assigned_at',
      cell: ({ row }) =>
        row.original.assigned_at
          ? new Date(row.original.assigned_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '-',
    },
    {
      id: 'activated_at',
      header: 'Date Activated',
      accessorKey: 'activated_at',
      cell: ({ row }) =>
        row.original.activated_at
          ? new Date(row.original.activated_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '-',
    },
    {
      id: 'cardholder',
      header: 'Cardholder',
      cell: ({ row }) =>
        row.original.cardholder_name ? (
          <span className="text-sm">{row.original.cardholder_name}</span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        ),
    },
    {
      id: 'actions',
      header: 'Assign Distributor',
      cell: ({ row }) => (
        <AssignDistributorDropdown
          cardId={row.original.id}
          currentDistributorId={row.original.distributor_id}
          distributors={distributors}
        />
      ),
    },
  ];
}
