'use client';

import { ChevronDown, ChevronUp, Filter } from 'lucide-react';

import { Button } from '@kit/ui/button';

import type {
  SalesCardTypeFilter,
  SalesFilters,
  SalesStatusFilter,
} from '../_lib/types/sales-filter.types';
import { CardTypeSelect } from './card-type-select';
import { DateRangeFilter } from './date-range-filter';
import { StatusSelect } from './status-select';

interface SalesFilterButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  activeFilterCount: number;
}

export function SalesFilterButton({
  isOpen,
  onToggle,
  activeFilterCount,
}: SalesFilterButtonProps) {
  return (
    <Button
      variant="outline"
      className="gap-2"
      onClick={onToggle}
      data-test="cards-filter-button"
    >
      <Filter className="h-4 w-4" />
      Filter
      {activeFilterCount > 0 && (
        <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
          {activeFilterCount}
        </span>
      )}
      {isOpen ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      )}
    </Button>
  );
}

interface SalesFilterContentProps {
  filters: SalesFilters;
  activeFilterCount: number;
  onDateChange: (
    field: 'soldFrom' | 'soldTo' | 'assignedFrom' | 'assignedTo',
    value: string | null,
  ) => void;
  onStatusChange: (value: SalesStatusFilter) => void;
  onCardTypeChange: (value: SalesCardTypeFilter) => void;
  onApply: () => void;
  onClear: () => void;
}

export function SalesFilterContent({
  filters,
  activeFilterCount,
  onDateChange,
  onStatusChange,
  onCardTypeChange,
  onApply,
  onClear,
}: SalesFilterContentProps) {
  return (
    <div className="border-x border-b bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-medium">Filter Cards</h3>
        <button
          onClick={onClear}
          disabled={activeFilterCount === 0}
          className="text-primary hover:text-primary/80 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear All
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <DateRangeFilter
          label="Date Sold"
          fromDate={filters.soldFrom}
          toDate={filters.soldTo}
          onFromChange={(date) => onDateChange('soldFrom', date)}
          onToChange={(date) => onDateChange('soldTo', date)}
        />
        <DateRangeFilter
          label="Date Assigned"
          fromDate={filters.assignedFrom}
          toDate={filters.assignedTo}
          onFromChange={(date) => onDateChange('assignedFrom', date)}
          onToChange={(date) => onDateChange('assignedTo', date)}
        />
        <div className="space-y-2">
          <span className="text-sm font-medium">Status</span>
          <StatusSelect
            value={filters.status}
            onChange={onStatusChange}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">Card Type</span>
          <CardTypeSelect
            value={filters.cardType}
            onChange={onCardTypeChange}
            className="w-full"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end border-t pt-4">
        <Button
          className="bg-brand-400 hover:bg-brand-400/90"
          onClick={onApply}
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
