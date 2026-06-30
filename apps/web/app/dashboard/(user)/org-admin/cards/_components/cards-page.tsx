'use client';

import { useCallback, useMemo, useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { Filter, LibraryBig, MoreHorizontal } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { EntityDataTable } from '../../../entities/_components/entity-data-table';
import { useCardsFilters } from '../_lib/hooks/use-cards-filters';
import type {
  DistributorOption,
  OrgCard,
} from '../_lib/server/cards-page.loader';
import { BulkAssignModal } from './bulk-assign-modal';
import { CardTile } from './card-tile';
import { CardsFilterDrawer } from './cards-filter-drawer';
import { CardsFilterButton, CardsFilterContent } from './cards-filter-panel';
import { CardsSelectionBar } from './cards-selection-bar';
import { getCardsColumns } from './cards-table-columns';

interface CardsPageProps {
  data: OrgCard[];
  pageCount: number;
  pageSize: number;
  page: number;
  query: string;
  totalCount: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  distributors: DistributorOption[];
  batchPrefixes: string[];
  unassignedCardCount: number;
  openBulkAssign?: boolean;
}

const sortOptions = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'display_code', label: 'Card Code' },
];

export function CardsPage({
  data,
  pageCount,
  pageSize,
  page,
  query,
  totalCount,
  sortBy,
  sortOrder,
  distributors,
  batchPrefixes,
  unassignedCardCount,
  openBulkAssign = false,
}: CardsPageProps) {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set(),
  );
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [bulkAssignModalOpen, setBulkAssignModalOpen] =
    useState(openBulkAssign);
  const [syncedOpenBulkAssign, setSyncedOpenBulkAssign] =
    useState(openBulkAssign);
  const router = useRouter();

  if (openBulkAssign && openBulkAssign !== syncedOpenBulkAssign) {
    setSyncedOpenBulkAssign(openBulkAssign);
    setBulkAssignModalOpen(true);
  }
  const pathname = usePathname();

  const {
    filters,
    activeFilterCount,
    setStatusFilter,
    setDistributorFilter,
    setBatchPrefixFilter,
    setDateFilter,
    clearFilters,
    isPending,
  } = useCardsFilters();

  const handleSelectCard = useCallback((cardId: string, selected: boolean) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(cardId);
      } else {
        next.delete(cardId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedCardIds(new Set(data.map((card) => card.id)));
      } else {
        setSelectedCardIds(new Set());
      }
    },
    [data],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedCardIds(new Set());
  }, []);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(window.location.search);
      params.set('page', String(newPage));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  const allSelected = data.length > 0 && selectedCardIds.size === data.length;
  const someSelected = selectedCardIds.size > 0 && !allSelected;

  const columns = useMemo(
    () =>
      getCardsColumns({
        distributors,
        selectedCardIds,
        onSelectCard: handleSelectCard,
        onSelectAll: handleSelectAll,
        allSelected,
        someSelected,
      }),
    [
      distributors,
      selectedCardIds,
      handleSelectCard,
      handleSelectAll,
      allSelected,
      someSelected,
    ],
  );

  return (
    <>
      {/* Selection bar - only shown when cards are selected */}
      <CardsSelectionBar
        selectedCount={selectedCardIds.size}
        selectedCardIds={Array.from(selectedCardIds)}
        distributors={distributors}
        onClearSelection={handleClearSelection}
      />

      <EntityDataTable
        data={data}
        columns={columns}
        pageCount={pageCount}
        pageSize={pageSize}
        page={page}
        title="Cards"
        totalCount={totalCount}
        searchPlaceholder="Search"
        searchQuery={query}
        sortBy={sortBy}
        sortOrder={sortOrder}
        sortOptions={sortOptions}
        isLoading={isPending}
        filterButton={
          <div className="flex items-center gap-2">
            <CardsFilterButton
              isOpen={filterPanelOpen}
              onToggle={() => setFilterPanelOpen(!filterPanelOpen)}
              activeFilterCount={activeFilterCount}
            />
            <Button
              disabled={selectedCardIds.size > 0}
              onClick={() => setBulkAssignModalOpen(true)}
              data-test="bulk-assign-button"
              className="bg-brand-400 hover:bg-brand-400/90 w-full gap-2 text-white"
            >
              <LibraryBig className="mr-1 h-4 w-4" />
              Bulk Assign
            </Button>
          </div>
        }
        filterContent={
          filterPanelOpen ? (
            <CardsFilterContent
              filters={filters}
              activeFilterCount={activeFilterCount}
              distributors={distributors}
              batchPrefixes={batchPrefixes}
              onStatusChange={setStatusFilter}
              onDistributorChange={setDistributorFilter}
              onBatchPrefixChange={setBatchPrefixFilter}
              onDateChange={setDateFilter}
              onClear={clearFilters}
            />
          ) : null
        }
        mobileFilterButton={
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setFilterDrawerOpen(true)}
              className="w-full gap-2"
            >
              <Filter className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button
              disabled={selectedCardIds.size > 0}
              onClick={() => setBulkAssignModalOpen(true)}
              className="bg-brand-400 hover:bg-brand-400/90 w-full gap-2 text-white"
              data-test="bulk-assign-button-mobile"
            >
              <LibraryBig className="h-4 w-4" />
              Bulk Assign
            </Button>
          </div>
        }
        mobileListComponent={
          <MobileCardsList
            data={data}
            pageCount={pageCount}
            page={page}
            distributors={distributors}
            selectedCardIds={selectedCardIds}
            onSelectCard={handleSelectCard}
            onPageChange={handlePageChange}
          />
        }
      />

      <CardsFilterDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        filters={filters}
        activeFilterCount={activeFilterCount}
        distributors={distributors}
        batchPrefixes={batchPrefixes}
        onStatusChange={setStatusFilter}
        onDistributorChange={setDistributorFilter}
        onBatchPrefixChange={setBatchPrefixFilter}
        onDateChange={setDateFilter}
        onClear={clearFilters}
      />

      <BulkAssignModal
        open={bulkAssignModalOpen}
        onOpenChange={setBulkAssignModalOpen}
        distributors={distributors}
        unassignedCardCount={unassignedCardCount}
      />
    </>
  );
}

function MobileCardsList({
  data,
  distributors,
  selectedCardIds,
  onSelectCard,
  page,
  pageCount,
  onPageChange,
}: {
  data: OrgCard[];
  distributors: DistributorOption[];
  selectedCardIds: Set<string>;
  onSelectCard: (cardId: string, selected: boolean) => void;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No cards found
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((card) => (
        <CardTile
          key={card.id}
          card={card}
          distributors={distributors}
          isSelected={selectedCardIds.has(card.id)}
          onSelect={(selected) => onSelectCard(card.id, selected)}
        />
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
