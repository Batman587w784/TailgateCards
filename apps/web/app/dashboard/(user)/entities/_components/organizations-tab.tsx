'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, ArrowUpRight, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  MerchantOption,
  OrganizationWithAccount,
} from '../_lib/server/entities-page.loader';
import {
  getOrganizationMerchantPartnersAction,
  toggleOrganizationStatusAction,
} from '../_lib/server/entities-server-actions';
import { CreateOrganizationForm } from './create-organization-form';
import { EntityDataTable } from './entity-data-table';
import { EntityFormModal } from './entity-form-modal';
import { EntitySortDrawer } from './entity-sort-drawer';
import { InlineFilters } from './inline-filters';
import { OrganizationDetailsModal } from './organization-details-modal';
import { OrganizationTile } from './tiles/organization-tile';

export interface OrganizationsFilters {
  state: string;
  city: string;
}

interface OrganizationsTabProps {
  data: OrganizationWithAccount[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  totalCount: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  merchants: MerchantOption[];
}

const sortOptions = [
  { value: 'organization_name', label: 'Name', orderType: 'alpha' as const },
  { value: 'created_at', label: 'Created Date', orderType: 'date' as const },
  { value: 'state', label: 'State', orderType: 'alpha' as const },
  { value: 'city', label: 'City', orderType: 'alpha' as const },
];

export function OrganizationsTab({
  data,
  pageCount,
  pageSize,
  page,
  query,
  totalCount,
  sortBy,
  sortOrder,
  merchants,
}: OrganizationsTabProps) {
  const [selectedOrg, setSelectedOrg] =
    useState<OrganizationWithAccount | null>(null);
  const [selectedOrgPartnerIds, setSelectedOrgPartnerIds] = useState<string[]>(
    [],
  );
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(query);

  const handleOpenDetails = useCallback(
    async (org: OrganizationWithAccount) => {
      setSelectedOrg(org);
      // Fetch partner IDs for the selected organization
      try {
        const result = await getOrganizationMerchantPartnersAction({
          organizationId: org.account_id,
        });
        if (result.success) {
          setSelectedOrgPartnerIds(result.data);
        }
      } catch {
        setSelectedOrgPartnerIds([]);
      }
    },
    [],
  );

  const handleCloseDetails = useCallback(() => {
    setSelectedOrg(null);
    setSelectedOrgPartnerIds([]);
  }, []);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: OrganizationsFilters = useMemo(
    () => ({
      state: searchParams.get('filterState') ?? '',
      city: searchParams.get('filterCity') ?? '',
    }),
    [searchParams],
  );

  const handleStateChange = (state: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (state) {
      params.set('filterState', state);
    } else {
      params.delete('filterState');
    }
    // Reset city when state changes
    params.delete('filterCity');
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCityChange = (city: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (city) {
      params.set('filterCity', city);
    } else {
      params.delete('filterCity');
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  // Filter data client-side based on state and city
  const filteredData = useMemo(() => {
    return data.filter((org) => {
      if (filters.state && org.state !== filters.state) {
        return false;
      }
      if (filters.city && org.city !== filters.city) {
        return false;
      }
      return true;
    });
  }, [data, filters]);

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
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  const actionButton = (
    <EntityFormModal
      title="Add Organization"
      description="Create a new organization. Fill in the details below."
      triggerLabel="Add Organization"
    >
      {({ onSuccess }) => (
        <CreateOrganizationForm onSuccess={onSuccess} merchants={merchants} />
      )}
    </EntityFormModal>
  );

  return (
    <>
      {/* Mobile: Action button */}
      <div className="mb-2 sm:hidden">{actionButton}</div>

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
      <div className="sm:hidden">
        <MobileOrganizationsList
          data={filteredData}
          onOpenDetails={handleOpenDetails}
          page={page}
          pageCount={pageCount}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Desktop: Data Table */}
      <div className="hidden sm:block">
        <EntityDataTable
          data={filteredData}
          columns={getColumns(handleOpenDetails)}
          pageCount={pageCount}
          pageSize={pageSize}
          page={page}
          title="Organizations"
          totalCount={totalCount}
          searchPlaceholder="Search"
          searchQuery={query}
          sortBy={sortBy}
          sortOrder={sortOrder}
          sortOptions={sortOptions}
          inlineFilters={
            <InlineFilters
              stateValue={filters.state}
              cityValue={filters.city}
              onStateChange={handleStateChange}
              onCityChange={handleCityChange}
            />
          }
          actionButton={actionButton}
        />
      </div>

      {/* Sort Drawer (Mobile) */}
      <EntitySortDrawer
        open={sortDrawerOpen}
        onOpenChange={setSortDrawerOpen}
        currentSortBy={sortBy}
        currentSortOrder={sortOrder ?? 'desc'}
        sortOptions={sortOptions}
      />

      {selectedOrg && (
        <OrganizationDetailsModal
          organization={selectedOrg}
          open={!!selectedOrg}
          onOpenChange={(open) => !open && handleCloseDetails()}
          merchants={merchants}
          currentPartnerIds={selectedOrgPartnerIds}
        />
      )}
    </>
  );
}

function MobileOrganizationsList({
  data,
  onOpenDetails,
  page,
  pageCount,
  onPageChange,
}: {
  data: OrganizationWithAccount[];
  onOpenDetails: (org: OrganizationWithAccount) => void;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No organizations found
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((org) => (
        <OrganizationTile
          key={org.id}
          organization={org}
          onOpenDetails={() => onOpenDetails(org)}
        />
      ))}

      {/* Pagination */}
      {pageCount > 1 && (
        <MobilePagination
          page={page}
          pageCount={pageCount}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

function MobilePagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
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
          ...
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
        className={`h-8 w-8 p-0 ${currentPage === i ? 'border-border' : ''}`}
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
          ...
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

  return <div className="flex items-center justify-end gap-1">{pages}</div>;
}

function getColumns(
  onOpenDetails: (org: OrganizationWithAccount) => void,
): ColumnDef<OrganizationWithAccount>[] {
  return [
    {
      id: 'organization_name',
      header: 'Organization Name',
      accessorKey: 'organization_name',
      cell: ({ row }) => (
        <OrganizationNameCell
          organization={row.original}
          onClick={() => onOpenDetails(row.original)}
        />
      ),
    },
    {
      id: 'is_active',
      header: 'Status',
      cell: ({ row }) => <StatusToggle organization={row.original} />,
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
    {
      id: 'total_revenue',
      header: 'Total Revenue',
      accessorKey: 'total_revenue',
      cell: ({ row }) => formatCurrency(row.original.total_revenue),
    },
  ];
}

function OrganizationNameCell({
  organization,
  onClick,
}: {
  organization: OrganizationWithAccount;
  onClick: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className="text-brand flex w-full cursor-pointer items-center justify-between hover:underline"
    >
      <span className="truncate">
        {organization.organization_name ?? 'N/A'}
      </span>
      <ArrowUpRight className="h-3 w-3 flex-shrink-0" />
    </span>
  );
}

function StatusToggle({
  organization,
}: {
  organization: OrganizationWithAccount;
}) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(organization.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleOrganizationStatusAction({
          accountId: organization.account_id,
          isActive: checked,
        });

        if (result.success) {
          if (checked) {
            toast.success('Organization activated successfully.');
          } else {
            toast.error('Organization deactivated successfully.');
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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
