'use client';

import { useCallback, useState, useTransition } from 'react';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpRight, Truck } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  DistributorAccount,
  MerchantOption,
  OrganizationOption,
  OrganizationWithAccount,
} from '../_lib/server/entities-page.loader';
import {
  getOrganizationByNameAction,
  getOrganizationMerchantPartnersAction,
  toggleDistributorStatusAction,
} from '../_lib/server/entities-server-actions';
import { DistributorDetailsModal } from './distributor-details-modal';
import { EntityDataTable } from './entity-data-table';
import { EntityMobileList } from './entity-mobile-list';
import { OrganizationDetailsModal } from './organization-details-modal';
import { DistributorTile } from './tiles/distributor-tile';

interface DistributorsTabProps {
  data: DistributorAccount[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  totalCount: number;
  organizations: OrganizationOption[];
  merchants: MerchantOption[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const sortOptions = [
  { value: 'name', label: 'Name', orderType: 'alpha' as const },
  { value: 'created_at', label: 'Created Date', orderType: 'date' as const },
  { value: 'total_sales', label: 'Total Sales', orderType: 'number' as const },
  {
    value: 'organization_name',
    label: 'Organization',
    orderType: 'alpha' as const,
  },
];

export function DistributorsTab({
  data,
  pageCount,
  pageSize,
  page,
  query,
  totalCount,
  merchants,
  sortBy,
  sortOrder,
}: DistributorsTabProps) {
  const [selectedDistributor, setSelectedDistributor] =
    useState<DistributorAccount | null>(null);
  const [selectedOrg, setSelectedOrg] =
    useState<OrganizationWithAccount | null>(null);
  const [selectedOrgPartnerIds, setSelectedOrgPartnerIds] = useState<string[]>(
    [],
  );

  const handleOpenOrgDetails = useCallback(async (organizationName: string) => {
    try {
      const result = await getOrganizationByNameAction({ organizationName });

      if (result.success) {
        const org = result.data as unknown as OrganizationWithAccount;
        setSelectedOrg(org);

        // Fetch merchant partner IDs
        try {
          const partnersResult = await getOrganizationMerchantPartnersAction({
            organizationId: org.account_id,
          });
          if (partnersResult.success) {
            setSelectedOrgPartnerIds(partnersResult.data);
          }
        } catch {
          setSelectedOrgPartnerIds([]);
        }
      }
    } catch {
      toast.error('Failed to load organization details');
    }
  }, []);

  const handleCloseOrgDetails = useCallback(() => {
    setSelectedOrg(null);
    setSelectedOrgPartnerIds([]);
  }, []);

  return (
    <>
      <EntityDataTable
        data={data}
        columns={getColumns(setSelectedDistributor, handleOpenOrgDetails)}
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
        mobileListComponent={
          <EntityMobileList
            data={data}
            pageCount={pageCount}
            currentPage={page}
            title="Distributors"
            titleIcon={<Truck className="text-muted-foreground h-4 w-4" />}
            keyExtractor={(distributor) => distributor.id}
            emptyMessage="No distributors found"
            renderTile={(distributor) => (
              <DistributorTile
                distributor={distributor}
                onOpenDetails={() => setSelectedDistributor(distributor)}
              />
            )}
          />
        }
      />

      {selectedDistributor && (
        <DistributorDetailsModal
          distributor={selectedDistributor}
          open={!!selectedDistributor}
          onOpenChange={(open) => !open && setSelectedDistributor(null)}
        />
      )}

      {selectedOrg && (
        <OrganizationDetailsModal
          organization={selectedOrg}
          open={!!selectedOrg}
          onOpenChange={(open) => !open && handleCloseOrgDetails()}
          merchants={merchants}
          currentPartnerIds={selectedOrgPartnerIds}
        />
      )}
    </>
  );
}

function getColumns(
  onOpenDetails: (distributor: DistributorAccount) => void,
  onOpenOrgDetails: (organizationName: string) => void,
): ColumnDef<DistributorAccount>[] {
  return [
    {
      id: 'name',
      header: 'Distributor Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <DistributorNameCell
          distributor={row.original}
          onClick={() => onOpenDetails(row.original)}
        />
      ),
    },
    {
      id: 'is_active',
      header: 'Status',
      cell: ({ row }) => <StatusToggle distributor={row.original} />,
    },
    {
      id: 'organization_name',
      header: 'Organization',
      accessorKey: 'organization_name',
      cell: ({ row }) => (
        <OrganizationCell
          name={row.original.organization_name}
          onOpenDetails={onOpenOrgDetails}
        />
      ),
    },
    {
      id: 'total_sales',
      header: 'Total Sales',
      accessorKey: 'total_sales',
      cell: ({ row }) => row.original.total_sales.toLocaleString(),
    },
    {
      id: 'created_at',
      header: 'Created Date',
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
  ];
}

function DistributorNameCell({
  distributor,
  onClick,
}: {
  distributor: DistributorAccount;
  onClick: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className="text-brand flex w-full cursor-pointer items-center justify-between hover:underline"
    >
      <span className="truncate">{distributor.name ?? 'N/A'}</span>
      <ArrowUpRight className="h-3 w-3 flex-shrink-0" />
    </span>
  );
}

function OrganizationCell({
  name,
  onOpenDetails,
}: {
  name: string | null;
  onOpenDetails: (name: string) => void;
}) {
  if (!name) return <span>—</span>;

  return (
    <span
      onClick={() => onOpenDetails(name)}
      className="text-brand cursor-pointer hover:underline"
    >
      {name}
    </span>
  );
}

function StatusToggle({ distributor }: { distributor: DistributorAccount }) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(distributor.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleDistributorStatusAction({
          accountId: distributor.id,
          isActive: checked,
        });

        if (result.success) {
          if (checked) {
            toast.success('Distributor activated successfully.');
          } else {
            toast.error('Distributor deactivated successfully.');
          }
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
