'use client';

import { useState, useTransition } from 'react';

import { ArrowUpRight } from 'lucide-react';

import { ColumnDef } from '@tanstack/react-table';

import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  DistrictWithStats,
  OrganizationOption,
} from '../_lib/server/entities-page.loader';
import { toggleCampusStatusAction } from '../_lib/server/districts-server-actions';
import { CreateCampusForm } from './create-campus-form';
import { DistrictDetailsModal } from './district-details-modal';
import { EntityDataTable } from './entity-data-table';
import { EntityFormModal } from './entity-form-modal';

interface DistrictsTabProps {
  data: DistrictWithStats[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  totalCount: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  organizations: OrganizationOption[];
}

const sortOptions = [
  { value: 'name', label: 'Name', orderType: 'alpha' as const },
  { value: 'created_at', label: 'Created Date', orderType: 'date' as const },
  { value: 'state', label: 'State', orderType: 'alpha' as const },
  { value: 'city', label: 'City', orderType: 'alpha' as const },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// REVIEW: mirrors OrganizationsTab; mobile-tile parity (other tabs render tiles
// on small screens) is a follow-up — the table is responsive/scrollable for now.
export function DistrictsTab({
  data,
  pageCount,
  pageSize,
  page,
  query,
  totalCount,
  sortBy,
  sortOrder,
  organizations,
}: DistrictsTabProps) {
  const [selected, setSelected] = useState<DistrictWithStats | null>(null);

  const actionButton = (
    <EntityFormModal
      title="Add Campus"
      description="Create a new campus (district). Fill in the details below."
      triggerLabel="Add Campus"
    >
      {({ onSuccess }) => <CreateCampusForm onSuccess={onSuccess} />}
    </EntityFormModal>
  );

  return (
    <>
      <div className="mb-2 sm:hidden">{actionButton}</div>

      <EntityDataTable
        data={data}
        columns={getColumns(setSelected)}
        pageCount={pageCount}
        pageSize={pageSize}
        page={page}
        title="Campuses"
        totalCount={totalCount}
        searchPlaceholder="Search campuses"
        searchQuery={query}
        sortBy={sortBy}
        sortOrder={sortOrder}
        sortOptions={sortOptions}
        actionButton={actionButton}
      />

      {selected && (
        <DistrictDetailsModal
          district={selected}
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
          organizations={organizations}
        />
      )}
    </>
  );
}

function getColumns(
  onOpenDetails: (district: DistrictWithStats) => void,
): ColumnDef<DistrictWithStats>[] {
  return [
    {
      id: 'name',
      header: 'Campus Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <span
          onClick={() => onOpenDetails(row.original)}
          className="text-brand flex w-full cursor-pointer items-center justify-between hover:underline"
        >
          <span className="truncate">{row.original.name}</span>
          <ArrowUpRight className="h-3 w-3 flex-shrink-0" />
        </span>
      ),
    },
    {
      id: 'is_active',
      header: 'Status',
      cell: ({ row }) => <StatusToggle district={row.original} />,
    },
    {
      id: 'district_type',
      header: 'Type',
      cell: ({ row }) => (row.original.district_type === 'campus' ? 'Campus' : 'Generic'),
    },
    {
      id: 'state',
      header: 'State',
      accessorKey: 'state',
      cell: ({ row }) => row.original.state ?? 'N/A',
    },
    {
      id: 'city',
      header: 'City',
      accessorKey: 'city',
      cell: ({ row }) => row.original.city ?? 'N/A',
    },
    {
      id: 'created_at',
      header: 'Created',
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
      id: 'chapter_count',
      header: 'Chapters',
      cell: ({ row }) => row.original.chapter_count,
    },
    {
      id: 'total_revenue',
      header: 'Total Raised',
      cell: ({ row }) => formatCurrency(row.original.total_revenue),
    },
  ];
}

function StatusToggle({ district }: { district: DistrictWithStats }) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(district.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleCampusStatusAction({
          districtId: district.id,
          isActive: checked,
        });

        if (result.success) {
          toast.success(checked ? 'Campus activated.' : 'Campus deactivated.');
        } else {
          setIsActive(!checked);
          toast.error('Failed to update status');
        }
      } catch {
        setIsActive(!checked);
        toast.error('Failed to update status');
      }
    });
  };

  return (
    <Switch
      checked={isActive}
      onCheckedChange={handleToggle}
      disabled={pending}
      className="data-[state=checked]:bg-green-500"
    />
  );
}
