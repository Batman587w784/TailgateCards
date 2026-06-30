'use client';

import { useCallback, useMemo, useTransition } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { CardsFilters } from '../types/cards-filter.types';

export function useCardsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const filters: CardsFilters = useMemo(
    () => ({
      statuses: searchParams.get('statuses')?.split(',').filter(Boolean) ?? [],
      distributors:
        searchParams.get('distributors')?.split(',').filter(Boolean) ?? [],
      batchPrefixes:
        searchParams.get('batchPrefixes')?.split(',').filter(Boolean) ?? [],
      createdFrom: searchParams.get('createdFrom'),
      createdTo: searchParams.get('createdTo'),
    }),
    [searchParams],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.statuses.length > 0) count++;
    if (filters.distributors.length > 0) count++;
    if (filters.batchPrefixes.length > 0) count++;
    if (filters.createdFrom || filters.createdTo) count++;
    return count;
  }, [filters]);

  const updateFilters = useCallback(
    (updates: Partial<CardsFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.statuses !== undefined) {
        if (updates.statuses.length > 0) {
          params.set('statuses', updates.statuses.join(','));
        } else {
          params.delete('statuses');
        }
      }

      if (updates.distributors !== undefined) {
        if (updates.distributors.length > 0) {
          params.set('distributors', updates.distributors.join(','));
        } else {
          params.delete('distributors');
        }
      }

      if (updates.batchPrefixes !== undefined) {
        if (updates.batchPrefixes.length > 0) {
          params.set('batchPrefixes', updates.batchPrefixes.join(','));
        } else {
          params.delete('batchPrefixes');
        }
      }

      if (updates.createdFrom !== undefined) {
        if (updates.createdFrom) {
          params.set('createdFrom', updates.createdFrom);
        } else {
          params.delete('createdFrom');
        }
      }

      if (updates.createdTo !== undefined) {
        if (updates.createdTo) {
          params.set('createdTo', updates.createdTo);
        } else {
          params.delete('createdTo');
        }
      }

      params.set('page', '1');

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams],
  );

  const setStatusFilter = useCallback(
    (statuses: string[]) => {
      updateFilters({ statuses });
    },
    [updateFilters],
  );

  const setDistributorFilter = useCallback(
    (distributors: string[]) => {
      updateFilters({ distributors });
    },
    [updateFilters],
  );

  const setBatchPrefixFilter = useCallback(
    (batchPrefixes: string[]) => {
      updateFilters({ batchPrefixes });
    },
    [updateFilters],
  );

  const setDateFilter = useCallback(
    (field: 'createdFrom' | 'createdTo', value: string | null) => {
      updateFilters({ [field]: value });
    },
    [updateFilters],
  );

  const clearFilters = useCallback(() => {
    updateFilters({
      statuses: [],
      distributors: [],
      batchPrefixes: [],
      createdFrom: null,
      createdTo: null,
    });
  }, [updateFilters]);

  return {
    filters,
    activeFilterCount,
    setStatusFilter,
    setDistributorFilter,
    setBatchPrefixFilter,
    setDateFilter,
    clearFilters,
    isPending,
  };
}
