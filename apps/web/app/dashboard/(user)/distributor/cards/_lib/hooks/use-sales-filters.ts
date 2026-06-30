'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';

import type {
  SalesCardTypeFilter,
  SalesFilters,
  SalesStatusFilter,
} from '../types/sales-filter.types';

const cardTypeValues = ['all', 'physical', 'digital'] as const;
const statusValues = ['all', 'active', 'inactive'] as const;

const queryParsers = {
  soldFrom: parseAsString.withDefault(''),
  soldTo: parseAsString.withDefault(''),
  assignedFrom: parseAsString.withDefault(''),
  assignedTo: parseAsString.withDefault(''),
  cardType: parseAsStringLiteral(cardTypeValues).withDefault('all'),
  status: parseAsStringLiteral(statusValues).withDefault('all'),
  page: parseAsInteger.withDefault(1),
};

export function useSalesFilters() {
  const [isPending, startTransition] = useTransition();

  const [queryState, setQueryState] = useQueryStates(queryParsers, {
    shallow: false,
  });

  // Local pending state for all filter values — applied to URL only on
  // "Apply Filters" click. Initialized from URL on first render.
  const [pendingFilters, setPendingFilters] = useState<SalesFilters>(() => ({
    soldFrom: queryState.soldFrom || null,
    soldTo: queryState.soldTo || null,
    assignedFrom: queryState.assignedFrom || null,
    assignedTo: queryState.assignedTo || null,
    cardType: queryState.cardType,
    status: queryState.status,
    query: null,
  }));

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (pendingFilters.soldFrom || pendingFilters.soldTo) count++;
    if (pendingFilters.assignedFrom || pendingFilters.assignedTo) count++;
    if (pendingFilters.status !== 'all') count++;
    if (pendingFilters.cardType !== 'all') count++;
    return count;
  }, [pendingFilters]);

  const setDateFilter = useCallback(
    (
      field: 'soldFrom' | 'soldTo' | 'assignedFrom' | 'assignedTo',
      value: string | null,
    ) => {
      setPendingFilters((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const setCardType = useCallback((value: SalesCardTypeFilter) => {
    setPendingFilters((prev) => ({ ...prev, cardType: value }));
  }, []);

  const setStatus = useCallback((value: SalesStatusFilter) => {
    setPendingFilters((prev) => ({ ...prev, status: value }));
  }, []);

  const applyFilters = useCallback(() => {
    startTransition(() => {
      void setQueryState({
        soldFrom: pendingFilters.soldFrom || null,
        soldTo: pendingFilters.soldTo || null,
        assignedFrom: pendingFilters.assignedFrom || null,
        assignedTo: pendingFilters.assignedTo || null,
        cardType:
          pendingFilters.cardType === 'all' ? null : pendingFilters.cardType,
        status: pendingFilters.status === 'all' ? null : pendingFilters.status,
        page: 1,
      });
    });
  }, [setQueryState, pendingFilters]);

  const clearFilters = useCallback(() => {
    setPendingFilters((prev) => ({
      ...prev,
      soldFrom: null,
      soldTo: null,
      assignedFrom: null,
      assignedTo: null,
      cardType: 'all',
      status: 'all',
      query: null,
    }));
    startTransition(() => {
      void setQueryState({
        soldFrom: null,
        soldTo: null,
        assignedFrom: null,
        assignedTo: null,
        cardType: null,
        status: null,
        page: 1,
      });
    });
  }, [setQueryState]);

  return {
    filters: pendingFilters,
    activeFilterCount,
    setDateFilter,
    setCardType,
    setStatus,
    applyFilters,
    clearFilters,
    isPending,
  };
}
