'use client';

import { Button } from '@kit/ui/button';

import type {
  SalesCardTypeFilter,
  SalesFilters,
  SalesStatusFilter,
} from '../_lib/types/sales-filter.types';
import { CardTypeSelect } from './card-type-select';
import { DateRangeFilter } from './date-range-filter';
import { StatusSelect } from './status-select';

interface SalesMobileFilterSectionProps {
  isOpen: boolean;
  filters: SalesFilters;
  onDateChange: (
    field: 'soldFrom' | 'soldTo' | 'assignedFrom' | 'assignedTo',
    value: string | null,
  ) => void;
  onStatusChange: (value: SalesStatusFilter) => void;
  onCardTypeChange: (value: SalesCardTypeFilter) => void;
  onApply: () => void;
  onClear: () => void;
}

export function SalesMobileFilterSection({
  isOpen,
  filters,
  onDateChange,
  onStatusChange,
  onCardTypeChange,
  onApply,
  onClear,
}: SalesMobileFilterSectionProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="mb-4 rounded-lg border bg-white p-4 sm:hidden">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-foreground text-lg font-semibold">Filter Cards</h3>
        <button onClick={onClear} className="text-brand text-sm">
          Clear All
        </button>
      </div>

      <div className="flex flex-col gap-4">
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
      </div>

      <div className="mt-4 flex justify-end border-t pt-4">
        <Button
          className="bg-brand text-brand-foreground hover:bg-brand/90"
          onClick={onApply}
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
