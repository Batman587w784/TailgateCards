'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ColumnDef } from '@tanstack/react-table';
import {
  ArrowUpDown,
  ArrowUpRight,
  Eye,
  MoreHorizontal,
  Pencil,
  Search,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { MerchantWithAccount } from '../_lib/server/entities-page.loader';
import { toggleMerchantStatusAction } from '../_lib/server/entities-server-actions';
import { CreateMerchantForm } from './create-merchant-form';
import { EntityDataTable } from './entity-data-table';
import { EntityFormModal } from './entity-form-modal';
import { EntitySortDrawer } from './entity-sort-drawer';
import { InlineFilters } from './inline-filters';
import { MerchantDetailsModal } from './merchant-details-modal';
import { PasscodeCell } from './passcode-cell';
import { MerchantTile } from './tiles/merchant-tile';

export interface MerchantsFilters {
  state: string;
  city: string;
}

interface MerchantsTabProps {
  data: MerchantWithAccount[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  totalCount: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const sortOptions = [
  { value: 'business_name', label: 'Name', orderType: 'alpha' as const },
  { value: 'created_at', label: 'Created Date', orderType: 'date' as const },
  { value: 'state', label: 'State', orderType: 'alpha' as const },
  { value: 'city', label: 'City', orderType: 'alpha' as const },
];

export function MerchantsTab({
  data,
  pageCount,
  pageSize,
  page,
  query,
  totalCount,
  sortBy,
  sortOrder,
}: MerchantsTabProps) {
  const [selectedMerchant, setSelectedMerchant] =
    useState<MerchantWithAccount | null>(null);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [sortDrawerOpen, setSortDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(query);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: MerchantsFilters = useMemo(
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
    return data.filter((merchant) => {
      if (filters.state && merchant.state !== filters.state) {
        return false;
      }
      if (filters.city && merchant.city !== filters.city) {
        return false;
      }
      return true;
    });
  }, [data, filters]);

  const handleOpenDetails = (
    merchant: MerchantWithAccount,
    editMode: boolean,
  ) => {
    setSelectedMerchant(merchant);
    setOpenInEditMode(editMode);
  };

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
      title="Add Merchant"
      description={
        <>
          To add or manage discounts for this merchant, please go to the{' '}
          <Link
            href="/dashboard/discounts"
            className="text-primary underline hover:no-underline"
          >
            Discounts
          </Link>{' '}
          page.
        </>
      }
      triggerLabel="Add Merchant"
    >
      {({ onSuccess }) => <CreateMerchantForm onSuccess={onSuccess} />}
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
        <MobileMerchantsList
          data={filteredData}
          onOpenDetails={(merchant) => handleOpenDetails(merchant, false)}
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
          sortBy={sortBy}
          sortOrder={sortOrder}
          sortOptions={sortOptions}
          title="Merchants"
          totalCount={totalCount}
          searchPlaceholder="Search"
          searchQuery={query}
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

      {selectedMerchant && (
        <MerchantDetailsModal
          merchant={selectedMerchant}
          open={!!selectedMerchant}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedMerchant(null);
              setOpenInEditMode(false);
            }
          }}
          initialEditMode={openInEditMode}
        />
      )}
    </>
  );
}

function MobileMerchantsList({
  data,
  onOpenDetails,
  page,
  pageCount,
  onPageChange,
}: {
  data: MerchantWithAccount[];
  onOpenDetails: (merchant: MerchantWithAccount) => void;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No merchants found
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((merchant) => (
        <MerchantTile
          key={merchant.id}
          merchant={merchant}
          onOpenDetails={() => onOpenDetails(merchant)}
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
  handleOpenDetails: (merchant: MerchantWithAccount, editMode: boolean) => void,
): ColumnDef<MerchantWithAccount>[] {
  return [
    {
      id: 'business_name',
      header: 'Merchant Name',
      accessorKey: 'business_name',
      size: 184,
      cell: ({ row }) => (
        <MerchantNameCell
          merchant={row.original}
          onClick={() => handleOpenDetails(row.original, false)}
        />
      ),
    },
    {
      id: 'is_active',
      header: 'Status',
      size: 142,
      cell: ({ row }) => <StatusToggle merchant={row.original} />,
    },
    {
      id: 'created_at',
      header: 'Created Date',
      accessorKey: 'created_at',
      size: 142,
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
      id: 'state',
      header: 'State',
      accessorKey: 'state',
      size: 142,
      cell: ({ row }) => row.original.state ?? 'N/A',
    },
    {
      id: 'city',
      header: 'City',
      accessorKey: 'city',
      size: 142,
      cell: ({ row }) => row.original.city ?? 'N/A',
    },
    {
      id: 'total_redemptions',
      header: 'Total Redemptions',
      accessorKey: 'total_redemptions',
      size: 142,
      cell: ({ row }) => row.original.total_redemptions.toLocaleString(),
    },
    {
      id: 'passcode',
      header: 'Passcode',
      size: 142,
      cell: ({ row }) => (
        <PasscodeCell
          accountId={row.original.account_id}
          passcode={row.original.passcode}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 85,
      cell: ({ row }) => (
        <ActionsDropdown
          onViewDetails={() => handleOpenDetails(row.original, false)}
          onEdit={() => handleOpenDetails(row.original, true)}
        />
      ),
    },
  ];
}

function MerchantNameCell({
  merchant,
  onClick,
}: {
  merchant: MerchantWithAccount;
  onClick: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className="text-brand flex w-full cursor-pointer items-center justify-between hover:underline"
    >
      <span className="truncate">{merchant.business_name ?? 'N/A'}</span>
      <ArrowUpRight className="h-3 w-3 flex-shrink-0" />
    </span>
  );
}

function StatusToggle({ merchant }: { merchant: MerchantWithAccount }) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(merchant.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleMerchantStatusAction({
          accountId: merchant.account_id,
          isActive: checked,
        });

        if (result.success) {
          toast.success(
            checked
              ? 'Merchant activated successfully'
              : 'Merchant deactivated successfully',
          );
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

function ActionsDropdown({
  onViewDetails,
  onEdit,
}: {
  onViewDetails: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onViewDetails}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
