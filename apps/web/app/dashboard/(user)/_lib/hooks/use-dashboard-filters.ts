'use client';

import { useCallback, useMemo, useTransition } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { DashboardFilters } from '../types/dashboard-filter.types';

export function useDashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const filters: DashboardFilters = useMemo(
    () => ({
      distributors:
        searchParams.get('distributors')?.split(',').filter(Boolean) ?? [],
      dateFrom: searchParams.get('from'),
      dateTo: searchParams.get('to'),
    }),
    [searchParams],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.distributors.length > 0) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    return count;
  }, [filters]);

  const updateFilters = useCallback(
    (updates: Partial<DashboardFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.distributors !== undefined) {
        if (updates.distributors.length > 0) {
          params.set('distributors', updates.distributors.join(','));
        } else {
          params.delete('distributors');
        }
      }

      if (updates.dateFrom !== undefined) {
        if (updates.dateFrom) {
          params.set('from', updates.dateFrom);
        } else {
          params.delete('from');
        }
      }

      if (updates.dateTo !== undefined) {
        if (updates.dateTo) {
          params.set('to', updates.dateTo);
        } else {
          params.delete('to');
        }
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams],
  );

  const setDistributorFilter = useCallback(
    (distributors: string[]) => {
      updateFilters({ distributors });
    },
    [updateFilters],
  );

  const setDateFilter = useCallback(
    (field: 'dateFrom' | 'dateTo', value: string | null) => {
      updateFilters({ [field]: value });
    },
    [updateFilters],
  );

  const setDateRangeFilter = useCallback(
    (dateFrom: string | null, dateTo: string | null) => {
      updateFilters({ dateFrom, dateTo });
    },
    [updateFilters],
  );

  const clearFilters = useCallback(() => {
    updateFilters({
      distributors: [],
      dateFrom: null,
      dateTo: null,
    });
  }, [updateFilters]);

  return {
    filters,
    activeFilterCount,
    setDistributorFilter,
    setDateFilter,
    setDateRangeFilter,
    clearFilters,
    isPending,
  };
}
