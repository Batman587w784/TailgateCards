'use client';

import { useMemo } from 'react';

import { format } from 'date-fns';
import { CalendarIcon, ChevronDown, ChevronUp, Filter } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import type { DashboardFilters } from '../../_lib/types/dashboard-filter.types';

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

export interface DistributorOption {
  id: string;
  name: string;
}

interface DashboardFilterButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  activeFilterCount: number;
}

export function DashboardFilterButton({
  isOpen,
  onToggle,
  activeFilterCount,
}: DashboardFilterButtonProps) {
  return (
    <Button
      variant="outline"
      className="gap-2"
      onClick={onToggle}
      data-test="dashboard-filter-button"
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

interface DashboardFilterContentProps {
  filters: DashboardFilters;
  activeFilterCount: number;
  distributors: DistributorOption[];
  onDistributorChange: (distributors: string[]) => void;
  onDateRangeChange: (dateFrom: string | null, dateTo: string | null) => void;
  onClear: () => void;
}

export function DashboardFilterContent({
  filters,
  activeFilterCount,
  distributors,
  onDistributorChange,
  onDateRangeChange,
  onClear,
}: DashboardFilterContentProps) {
  const dateRange: DateRange | undefined = useMemo(() => {
    if (!filters.dateFrom) return undefined;
    return {
      from: new Date(filters.dateFrom),
      to: filters.dateTo ? new Date(filters.dateTo) : undefined,
    };
  }, [filters.dateFrom, filters.dateTo]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from) {
      const fromStr = format(range.from, 'yyyy-MM-dd');
      const toStr = range.to ? format(range.to, 'yyyy-MM-dd') : null;
      onDateRangeChange(fromStr, toStr);
    } else {
      onDateRangeChange(null, null);
    }
  };

  const handleDistributorChange = (distributorId: string) => {
    // Single selection - wrap in array for compatibility with filters
    if (distributorId === 'all') {
      onDistributorChange([]);
    } else {
      onDistributorChange([distributorId]);
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filter Dashboard</h3>
        {activeFilterCount > 0 && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={onClear}
          >
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Date Range Filter */}
        <div className="space-y-3">
          <span className="text-sm font-medium">Date Range</span>
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

        {/* Distributor Filter */}
        <div className="space-y-3">
          <span className="text-sm font-medium">Distributor</span>
          <Select
            value={filters.distributors[0] ?? 'all'}
            onValueChange={handleDistributorChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select distributor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Distributors</SelectItem>
              {distributors.map((dist) => (
                <SelectItem key={dist.id} value={dist.id}>
                  {dist.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
