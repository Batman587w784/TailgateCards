'use client';

import { useCallback, useState, useTransition } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { ColumnDef } from '@tanstack/react-table';
import {
  ArrowUpDown,
  ArrowUpRight,
  MoreHorizontal,
  Search,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { EntityDataTable } from '../../entities/_components/entity-data-table';
import { EntityFormModal } from '../../entities/_components/entity-form-modal';
import {
  DiscountWithMerchant,
  MerchantOption,
} from '../_lib/server/discounts-page.loader';
import { toggleDiscountStatusAction } from '../_lib/server/discounts-server-actions';
import { CreateDiscountForm } from './create-discount-form';
import { DiscountTile } from './discount-tile';
import { DiscountsSortDrawer } from './discounts-sort-drawer';
import { EditDiscountModal } from './edit-discount-modal';

interface DiscountsPageProps {
  data: DiscountWithMerchant[];
  merchants: MerchantOption[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  totalCount: number;
}

export function DiscountsPage({
  data,
  merchants,
  pageCount,
  pageSize,
  page,
  query,
  sortBy,
  sortOrder,
  totalCount,
}: DiscountsPageProps) {
  const [selectedDiscount, setSelectedDiscount] =
    useState<DiscountWithMerchant | null>(null);
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
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  const actionButton = (
    <EntityFormModal
      title="Create Discount"
      description="Add a new discount. Discount applies to all organizations in the merchant's city."
      triggerLabel="Create Discount"
    >
      {({ onSuccess }) => (
        <CreateDiscountForm onSuccess={onSuccess} merchants={merchants} />
      )}
    </EntityFormModal>
  );

  const mobileListComponent = (
    <MobileDiscountsList
      data={data}
      onEdit={setSelectedDiscount}
      page={page}
      pageCount={pageCount}
      onPageChange={handlePageChange}
    />
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
      <div className="sm:hidden">{mobileListComponent}</div>

      {/* Desktop: Data Table */}
      <div className="hidden sm:block">
        <EntityDataTable
          data={data}
          columns={getColumns(setSelectedDiscount)}
          pageCount={pageCount}
          pageSize={pageSize}
          page={page}
          title="Discounts"
          totalCount={totalCount}
          searchPlaceholder="Search"
          searchQuery={query}
          actionButton={actionButton}
          sortBy={sortBy}
          sortOrder={sortOrder}
          mobileListComponent={mobileListComponent}
        />
      </div>

      {/* Sort Drawer (Mobile) */}
      <DiscountsSortDrawer
        open={sortDrawerOpen}
        onOpenChange={setSortDrawerOpen}
        currentSortBy={sortBy}
        currentSortOrder={sortOrder}
      />

      {selectedDiscount && (
        <EditDiscountModal
          discount={selectedDiscount}
          open={!!selectedDiscount}
          onOpenChange={(open) => !open && setSelectedDiscount(null)}
        />
      )}
    </>
  );
}

function MobileDiscountsList({
  data,
  onEdit,
  page,
  pageCount,
  onPageChange,
}: {
  data: DiscountWithMerchant[];
  onEdit: (discount: DiscountWithMerchant) => void;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No discounts found
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((discount) => (
        <DiscountTile key={discount.id} discount={discount} onEdit={onEdit} />
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

function getColumns(
  onOpenDetails: (discount: DiscountWithMerchant) => void,
): ColumnDef<DiscountWithMerchant>[] {
  return [
    {
      id: 'title',
      header: 'Name',
      accessorKey: 'title',
      cell: ({ row }) => (
        <DiscountNameCell
          discount={row.original}
          onClick={() => onOpenDetails(row.original)}
        />
      ),
    },
    {
      id: 'merchant',
      header: 'Merchant',
      cell: ({ row }) =>
        row.original.merchant.business_name ?? 'Unknown Merchant',
    },
    {
      id: 'city',
      header: 'City',
      cell: ({ row }) => row.original.merchant.city ?? 'No city set',
    },
    {
      id: 'is_active',
      header: 'Status',
      cell: ({ row }) => <StatusToggle discount={row.original} />,
    },
    {
      id: 'redemption_count',
      header: 'Redemptions',
      accessorKey: 'redemption_count',
      cell: ({ row }) => row.original.redemption_count.toLocaleString(),
    },
  ];
}

function DiscountNameCell({
  discount,
  onClick,
}: {
  discount: DiscountWithMerchant;
  onClick: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className="text-brand flex w-full cursor-pointer items-center justify-between hover:underline"
    >
      <span className="truncate">{discount.title}</span>
      <ArrowUpRight className="h-3 w-3 flex-shrink-0" />
    </span>
  );
}

function StatusToggle({ discount }: { discount: DiscountWithMerchant }) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(discount.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleDiscountStatusAction({
          discountId: discount.id,
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
    />
  );
}
