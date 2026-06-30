'use client';

import { useMemo } from 'react';

import { format } from 'date-fns';
import { CalendarIcon, ChevronDown, ChevronUp, Filter } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { cn } from '@kit/ui/utils';

import type { DistributorOption } from '../_lib/server/cards-page.loader';
import type { CardsFilters } from '../_lib/types/cards-filter.types';

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'activated', label: 'Activated' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface CardsFilterButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  activeFilterCount: number;
}

export function CardsFilterButton({
  isOpen,
  onToggle,
  activeFilterCount,
}: CardsFilterButtonProps) {
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

interface CardsFilterContentProps {
  filters: CardsFilters;
  activeFilterCount: number;
  distributors: DistributorOption[];
  batchPrefixes: string[];
  onStatusChange: (statuses: string[]) => void;
  onDistributorChange: (distributors: string[]) => void;
  onBatchPrefixChange: (batchPrefixes: string[]) => void;
  onDateChange: (
    field: 'createdFrom' | 'createdTo',
    value: string | null,
  ) => void;
  onClear: () => void;
}

export function CardsFilterContent({
  filters,
  activeFilterCount,
  distributors,
  batchPrefixes,
  onStatusChange,
  onDistributorChange,
  onBatchPrefixChange,
  onDateChange,
  onClear,
}: CardsFilterContentProps) {
  const dateRange: DateRange | undefined = useMemo(() => {
    if (!filters.createdFrom) return undefined;
    return {
      from: new Date(filters.createdFrom),
      to: filters.createdTo ? new Date(filters.createdTo) : undefined,
    };
  }, [filters.createdFrom, filters.createdTo]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from) {
      const fromStr = format(range.from, 'yyyy-MM-dd');
      onDateChange('createdFrom', fromStr);

      if (range.to) {
        const toStr = format(range.to, 'yyyy-MM-dd');
        onDateChange('createdTo', toStr);
      } else {
        onDateChange('createdTo', null);
      }
    } else {
      onDateChange('createdFrom', null);
      onDateChange('createdTo', null);
    }
  };

  const toggleStatus = (status: string) => {
    const current = filters.statuses;
    if (current.includes(status)) {
      onStatusChange(current.filter((s) => s !== status));
    } else {
      onStatusChange([...current, status]);
    }
  };

  const toggleDistributor = (distributorId: string) => {
    const current = filters.distributors;
    if (current.includes(distributorId)) {
      onDistributorChange(current.filter((d) => d !== distributorId));
    } else {
      onDistributorChange([...current, distributorId]);
    }
  };

  const toggleBatchPrefix = (prefix: string) => {
    const current = filters.batchPrefixes;
    if (current.includes(prefix)) {
      onBatchPrefixChange(current.filter((p) => p !== prefix));
    } else {
      onBatchPrefixChange([...current, prefix]);
    }
  };

  return (
    <div className="border-x border-b p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filter Cards</h3>
        {activeFilterCount > 0 && (
          <button
            onClick={onClear}
            className="text-primary hover:text-primary/80 text-sm font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Status Filter */}
        <div className="space-y-3">
          <span className="text-sm font-medium">Status</span>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((status) => (
              <div key={status.value} className="flex items-center gap-2">
                <Checkbox
                  id={`status-${status.value}`}
                  checked={filters.statuses.includes(status.value)}
                  onCheckedChange={() => toggleStatus(status.value)}
                />
                <Label
                  htmlFor={`status-${status.value}`}
                  className="cursor-pointer text-sm font-normal"
                >
                  {status.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Distributor Filter */}
        <div className="space-y-3">
          <span className="text-sm font-medium">Distributor</span>
          <div className="max-h-32 space-y-2 overflow-y-auto">
            <div className="flex items-center gap-2">
              <Checkbox
                id="distributor-unassigned"
                checked={filters.distributors.includes('unassigned')}
                onCheckedChange={() => toggleDistributor('unassigned')}
              />
              <Label
                htmlFor="distributor-unassigned"
                className="text-muted-foreground cursor-pointer text-sm font-normal italic"
              >
                Unassigned
              </Label>
            </div>
            {distributors.map((dist) => (
              <div key={dist.id} className="flex items-center gap-2">
                <Checkbox
                  id={`distributor-${dist.id}`}
                  checked={filters.distributors.includes(dist.id)}
                  onCheckedChange={() => toggleDistributor(dist.id)}
                />
                <Label
                  htmlFor={`distributor-${dist.id}`}
                  className="cursor-pointer text-sm font-normal"
                >
                  {dist.name}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Batch Prefix Filter */}
        <div className="space-y-3">
          <span className="text-sm font-medium">Batch</span>
          <div className="max-h-32 space-y-2 overflow-y-auto">
            {batchPrefixes.length === 0 ? (
              <span className="text-muted-foreground text-sm">
                No batches available
              </span>
            ) : (
              batchPrefixes.map((prefix) => (
                <div key={prefix} className="flex items-center gap-2">
                  <Checkbox
                    id={`batch-${prefix}`}
                    checked={filters.batchPrefixes.includes(prefix)}
                    onCheckedChange={() => toggleBatchPrefix(prefix)}
                  />
                  <Label
                    htmlFor={`batch-${prefix}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {prefix}
                  </Label>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Date Filter */}
        <div className="space-y-3">
          <span className="text-sm font-medium">Date Created</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dateRange && 'text-muted-foreground',
                )}
              >
                <span className="truncate">
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MMM d')} -{' '}
                        {format(dateRange.to, 'MMM d')}
                      </>
                    ) : (
                      format(dateRange.from, 'MMM d, yyyy')
                    )
                  ) : (
                    'Date range'
                  )}
                </span>
                <CalendarIcon className="text-primary ml-auto h-4 w-4 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleDateRangeChange}
                numberOfMonths={1}
              />
              {dateRange && (
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => handleDateRangeChange(undefined)}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
