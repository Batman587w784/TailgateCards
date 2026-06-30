'use client';

import { useMemo } from 'react';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
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

interface CardsFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function CardsFilterDrawer({
  open,
  onOpenChange,
  filters,
  activeFilterCount,
  distributors,
  batchPrefixes,
  onStatusChange,
  onDistributorChange,
  onBatchPrefixChange,
  onDateChange,
  onClear,
}: CardsFilterDrawerProps) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader className="mb-4 flex flex-row items-center justify-between">
          <SheetTitle>Filter Cards</SheetTitle>
          {activeFilterCount > 0 && (
            <button
              onClick={onClear}
              className="text-primary hover:text-primary/80 text-sm font-medium"
            >
              Clear All
            </button>
          )}
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto pb-20">
          {/* Status Filter */}
          <div className="space-y-3">
            <span className="text-sm font-medium">Status</span>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((status) => (
                <div key={status.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`mobile-status-${status.value}`}
                    checked={filters.statuses.includes(status.value)}
                    onCheckedChange={() => toggleStatus(status.value)}
                  />
                  <Label
                    htmlFor={`mobile-status-${status.value}`}
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
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mobile-distributor-unassigned"
                  checked={filters.distributors.includes('unassigned')}
                  onCheckedChange={() => toggleDistributor('unassigned')}
                />
                <Label
                  htmlFor="mobile-distributor-unassigned"
                  className="text-muted-foreground cursor-pointer text-sm font-normal italic"
                >
                  Unassigned
                </Label>
              </div>
              {distributors.map((dist) => (
                <div key={dist.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`mobile-distributor-${dist.id}`}
                    checked={filters.distributors.includes(dist.id)}
                    onCheckedChange={() => toggleDistributor(dist.id)}
                  />
                  <Label
                    htmlFor={`mobile-distributor-${dist.id}`}
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
            <div className="space-y-2">
              {batchPrefixes.length === 0 ? (
                <span className="text-muted-foreground text-sm">
                  No batches available
                </span>
              ) : (
                batchPrefixes.map((prefix) => (
                  <div key={prefix} className="flex items-center gap-2">
                    <Checkbox
                      id={`mobile-batch-${prefix}`}
                      checked={filters.batchPrefixes.includes(prefix)}
                      onCheckedChange={() => toggleBatchPrefix(prefix)}
                    />
                    <Label
                      htmlFor={`mobile-batch-${prefix}`}
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

        <div className="bg-background absolute right-0 bottom-0 left-0 border-t p-4">
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
