'use client';

import { useCallback, useMemo, useTransition } from 'react';

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs';

import type { CardsFilters } from '../types/filter.types';

const queryParsers = {
  status: parseAsArrayOf(parseAsString).withDefault([]),
  batch: parseAsArrayOf(parseAsString).withDefault([]),
  organization: parseAsArrayOf(parseAsString).withDefault([]),
  distributor: parseAsArrayOf(parseAsString).withDefault([]),
  dateCreated: parseAsArrayOf(parseAsString).withDefault([]),
  cardType: parseAsArrayOf(parseAsString).withDefault([]),
  page: parseAsInteger.withDefault(1),
};

const THROTTLE_MS = 300;

export function useCardsFilters() {
  const [isPending, startTransition] = useTransition();

  const [queryState, setQueryState] = useQueryStates(queryParsers, {
    throttleMs: THROTTLE_MS,
    shallow: false,
  });

  const filters: CardsFilters = useMemo(
    () => ({
      status: queryState.status,
      batch: queryState.batch,
      organization: queryState.organization,
      distributor: queryState.distributor,
      dateCreated: queryState.dateCreated,
      cardType: queryState.cardType,
    }),
    [queryState],
  );

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).flat().filter(Boolean).length;
  }, [filters]);

  const setFilters = useCallback(
    (newFilters: CardsFilters) => {
      startTransition(() => {
        void setQueryState({
          ...newFilters,
          page: 1,
        });
      });
    },
    [setQueryState],
  );

  const clearFilters = useCallback(() => {
    startTransition(() => {
      void setQueryState({
        status: null,
        batch: null,
        organization: null,
        distributor: null,
        dateCreated: null,
        cardType: null,
        page: 1,
      });
    });
  }, [setQueryState]);

  const toggleFilter = useCallback(
    (category: keyof CardsFilters, value: string) => {
      const current = filters[category];
      const newValues = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      startTransition(() => {
        void setQueryState({
          [category]: newValues.length > 0 ? newValues : null,
          page: 1,
        });
      });
    },
    [filters, setQueryState],
  );

  return {
    filters,
    activeFilterCount,
    setFilters,
    clearFilters,
    toggleFilter,
    isPending,
  };
}
