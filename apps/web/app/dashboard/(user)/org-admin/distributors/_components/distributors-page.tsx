'use client';

import { useState, useTransition } from 'react';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpRight, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { DistributorDetailsModal } from '../../../entities/_components/distributor-details-modal';
import { EntityDataTable } from '../../../entities/_components/entity-data-table';
import { EntityFormModal } from '../../../entities/_components/entity-form-modal';
import { EntityMobileList } from '../../../entities/_components/entity-mobile-list';
import type { DistributorAccount } from '../../../entities/_lib/server/entities-page.loader';
import { BulkAssignModal } from '../../cards/_components/bulk-assign-modal';
import type { DistributorOption } from '../_lib/server/distributors-page.loader';
import { OrgDistributor } from '../_lib/server/distributors-page.loader';
import {
  toggleDistributorStatusAction,
  updateDistributorNameAction,
} from '../_lib/server/distributors-server-actions';
import { AddDistributorForm } from './add-distributor-form';
import { DistributorTile } from './distributor-tile';

interface DistributorsPageProps {
  data: OrgDistributor[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  totalCount: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  distributorOptions: DistributorOption[];
  unassignedCardCount: number;
}

const sortOptions = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'name', label: 'Name' },
];

function toDistributorAccount(distributor: OrgDistributor): DistributorAccount {
  return {
    id: distributor.id,
    name: distributor.name,
    email: distributor.email,
    phone: distributor.phone,
    account_role: 'distributor',
    is_active: distributor.is_active,
    created_at: distributor.created_at,
    organization_name: null,
    total_sales: distributor.activated_cards,
    total_earnings_cents: distributor.total_earnings_cents,
    assigned_cards: distributor.assigned_cards,
  };
}

export function DistributorsPage({
  data,
  pageCount,
  pageSize,
  page,
  query,
  totalCount,
  sortBy,
  sortOrder,
  distributorOptions,
  unassignedCardCount,
}: DistributorsPageProps) {
  const [selectedDistributor, setSelectedDistributor] =
    useState<OrgDistributor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false);

  const handleDistributorClick = (distributor: OrgDistributor) => {
    setSelectedDistributor(distributor);
    setModalOpen(true);
  };

  return (
    <>
      <EntityDataTable
        data={data}
        columns={getColumns(handleDistributorClick)}
        pageCount={pageCount}
        pageSize={pageSize}
        page={page}
        title="Distributors"
        totalCount={totalCount}
        searchPlaceholder="Search"
        searchQuery={query}
        sortBy={sortBy}
        sortOrder={sortOrder}
        sortOptions={sortOptions}
        actionButton={
          <div className="flex gap-2">
            <EntityFormModal
              title="Add Distributor"
              description="Invite a new distributor to your organization."
              triggerLabel="Add Distributor"
            >
              {({ onSuccess }) => <AddDistributorForm onSuccess={onSuccess} />}
            </EntityFormModal>
            <Button
              onClick={() => setBulkAssignModalOpen(true)}
              className="bg-brand-400 text-brand-foreground hover:bg-brand-400/90"
              data-test="bulk-assign-button"
            >
              Bulk Assign
            </Button>
          </div>
        }
        mobileListComponent={
          <EntityMobileList
            data={data}
            pageCount={pageCount}
            currentPage={page}
            title="Distributors"
            titleIcon={<Users className="text-muted-foreground h-4 w-4" />}
            keyExtractor={(distributor) => distributor.id}
            emptyMessage="No distributors found"
            renderTile={(distributor) => (
              <DistributorTile
                distributor={distributor}
                onNameClick={handleDistributorClick}
              />
            )}
          />
        }
      />

      {selectedDistributor && (
        <DistributorDetailsModal
          distributor={toDistributorAccount(selectedDistributor)}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSaveName={async (name) => {
            // The action throws on failure (org gate / verify), which the modal
            // surfaces as an error toast.
            await updateDistributorNameAction({
              distributorId: selectedDistributor.id,
              name,
            });
            return { success: true as const };
          }}
        />
      )}

      <BulkAssignModal
        open={bulkAssignModalOpen}
        onOpenChange={setBulkAssignModalOpen}
        distributors={distributorOptions}
        unassignedCardCount={unassignedCardCount}
      />
    </>
  );
}

function getColumns(
  onDistributorClick: (distributor: OrgDistributor) => void,
): ColumnDef<OrgDistributor>[] {
  return [
    {
      id: 'name',
      header: 'Distributor Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <DistributorNameCell
          distributor={row.original}
          onClick={() => onDistributorClick(row.original)}
        />
      ),
    },
    {
      id: 'is_active',
      header: 'Status',
      cell: ({ row }) => <StatusToggle distributor={row.original} />,
    },
    {
      id: 'activated_cards',
      header: 'Total Sales',
      accessorKey: 'activated_cards',
      cell: ({ row }) => row.original.activated_cards.toLocaleString(),
    },
    {
      id: 'assigned_cards',
      header: 'Assigned Cards',
      accessorKey: 'assigned_cards',
      cell: ({ row }) => row.original.assigned_cards.toLocaleString(),
    },
    {
      id: 'created_at',
      header: 'Created Date',
      accessorKey: 'created_at',
      cell: ({ row }) =>
        row.original.created_at
          ? new Date(row.original.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '-',
    },
  ];
}

function DistributorNameCell({
  distributor,
  onClick,
}: {
  distributor: OrgDistributor;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-brand hover:text-brand-600 flex w-full items-center justify-between hover:underline"
      data-test="distributor-name-cell"
    >
      <span className="truncate">{distributor.name}</span>
      <ArrowUpRight className="h-3 w-3 flex-shrink-0" />
    </button>
  );
}

function StatusToggle({ distributor }: { distributor: OrgDistributor }) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(distributor.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleDistributorStatusAction({
          distributorId: distributor.id,
          isActive: checked,
        });

        if (!result.success) {
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
      data-test="distributor-status-toggle"
    />
  );
}
