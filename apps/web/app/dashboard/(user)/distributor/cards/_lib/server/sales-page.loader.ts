import 'server-only';

import { cache } from 'react';

import { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import { Database } from '~/lib/database.types';
import {
  getUserTimezone,
  zonedDayEndUTC,
  zonedDayStartUTC,
} from '~/lib/dates/zoned-day';

import {
  STATUS_FILTER_TO_DB,
  type SaleData,
  type SalesFilters,
} from '../types/sales-filter.types';

const DEFAULT_PAGE_SIZE = 10;

export interface LoadSalesParams {
  page?: number;
  pageSize?: number;
  query?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: SalesFilters;
}

export interface LoadSalesResult {
  data: SaleData[];
  count: number;
  pageCount: number;
}

const saleSortColumns: Record<string, string> = {
  display_code: 'card_number',
  activated_at: 'activated_at',
  assigned_at: 'assigned_at',
  price_cents: 'price_cents',
};

/**
 * Get the current user's ID if they have a distributor role.
 * Cards table uses user_id as distributor_id, not account_id.
 */
export async function getUserDistributorId(
  client: SupabaseClient<Database>,
): Promise<string | null> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  // Check if user has a distributor role membership
  const { data } = await client
    .from('accounts_memberships')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('account_role', 'distributor')
    .limit(1)
    .maybeSingle();

  // Return the user's ID if they have a distributor membership
  return data?.user_id ?? null;
}

export const loadDistributorSales = cache(salesLoader);

async function salesLoader(
  params: LoadSalesParams = {},
): Promise<LoadSalesResult> {
  const client = getSupabaseServerClient();
  const distributorId = await getUserDistributorId(client);

  if (!distributorId) {
    return { data: [], count: 0, pageCount: 0 };
  }

  const {
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    query,
    sortBy,
    sortOrder = 'desc',
    filters,
  } = params;

  const tz = await getUserTimezone();

  // Build count query
  let countQuery = client
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('distributor_id', distributorId);

  // Apply date range filters to count query
  countQuery = applyDateFilters(countQuery, filters, tz);
  countQuery = applyCardTypeFilter(countQuery, filters);
  countQuery = applyStatusFilter(countQuery, filters);

  const { count: totalCount, error: countError } = await countQuery;
  if (countError) throw countError;

  const safeCount = totalCount ?? 0;
  const pageCount = Math.ceil(safeCount / pageSize);

  // If requested page is beyond available data, return empty
  if (page > pageCount && pageCount > 0) {
    return { data: [], count: safeCount, pageCount };
  }

  // If no data at all
  if (safeCount === 0) {
    return { data: [], count: 0, pageCount: 0 };
  }

  const sortColumn =
    sortBy && saleSortColumns[sortBy]
      ? saleSortColumns[sortBy]
      : 'activated_at';

  // Build main query
  // NOTE: card_type and digital_card_number columns are added by migration
  // 20260508100446 — typegen has not yet been re-run, so they appear via the
  // unknown-cast on the result rather than the typed select.
  let queryBuilder = (client as SupabaseClient)
    .from('cards')
    .select(
      `
      id,
      card_number,
      card_type,
      digital_card_number,
      status,
      activated_at,
      assigned_at,
      price_cents,
      organization_id,
      batch_id,
      cardholder_id,
      organization:accounts!cards_organization_id_fkey(id, name, card_prefix),
      batch:batches(id, name, prefix),
      cardholder:accounts!cards_cardholder_id_fkey(id, name)
    `,
    )
    .eq('distributor_id', distributorId)
    .order(sortColumn, { ascending: sortOrder === 'asc', nullsFirst: false });

  // Apply date range filters
  queryBuilder = applyDateFilters(queryBuilder, filters, tz);
  queryBuilder = applyCardTypeFilter(queryBuilder, filters);
  queryBuilder = applyStatusFilter(queryBuilder, filters);

  // Handle search query
  const searchQuery = query?.trim();
  const MAX_SEARCH_RESULTS = 1000;

  const { data, error } = searchQuery
    ? await queryBuilder.range(0, MAX_SEARCH_RESULTS - 1)
    : await queryBuilder.range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  // Type for card data from query
  type CardQueryResult = {
    id: string;
    card_number: number | null;
    card_type: 'physical' | 'digital';
    digital_card_number: number | null;
    status: string;
    activated_at: string | null;
    assigned_at: string | null;
    price_cents: number | null;
    organization_id: string;
    batch_id: string | null;
    cardholder_id: string | null;
    organization: {
      id: string;
      name: string;
      card_prefix: string | null;
    } | null;
    batch: { id: string; name: string; prefix: string | null } | null;
    cardholder: { id: string; name: string } | null;
  };

  // Transform data to SaleData format
  const salesData: SaleData[] = (
    (data as unknown as CardQueryResult[]) ?? []
  ).map((card) => {
    const org = card.organization;
    const batch = card.batch;
    const cardholder = card.cardholder;

    const displayCode = formatCardDisplayCode({
      card_type: card.card_type,
      card_number: card.card_number,
      digital_card_number: card.digital_card_number,
      organization_prefix: org?.card_prefix ?? null,
      batch_prefix: batch?.prefix ?? null,
    });

    return {
      id: card.id,
      display_code: displayCode,
      status: card.status,
      card_type: card.card_type,
      activated_at: card.activated_at,
      assigned_at: card.assigned_at,
      price_cents: card.price_cents,
      organization_name: org?.name ?? 'Unknown',
      batch_name: batch?.name ?? null,
      cardholder_name: cardholder?.name ?? null,
    };
  });

  // Apply search filter (client-side)
  let filteredSales = salesData;
  if (searchQuery) {
    const lowerQuery = searchQuery.toLowerCase();
    const dashCount = (searchQuery.match(/-/g) || []).length;

    if (dashCount >= 2) {
      // Two or more dashes: exact match on display_code (e.g., "ACME-SPR25-123")
      filteredSales = filteredSales.filter(
        (sale) => sale.display_code.toLowerCase() === lowerQuery,
      );
    } else {
      // Partial match: search across display_code, org name, batch name
      filteredSales = filteredSales.filter(
        (sale) =>
          sale.display_code.toLowerCase().includes(lowerQuery) ||
          sale.organization_name.toLowerCase().includes(lowerQuery) ||
          (sale.batch_name?.toLowerCase().includes(lowerQuery) ?? false),
      );
    }

    // Apply pagination to filtered results
    const filteredCount = filteredSales.length;
    const filteredPageCount = Math.ceil(filteredCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedSales = filteredSales.slice(
      startIndex,
      startIndex + pageSize,
    );

    return {
      data: paginatedSales,
      count: filteredCount,
      pageCount: filteredPageCount,
    };
  }

  return {
    data: filteredSales,
    count: safeCount,
    pageCount,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCardTypeFilter<T extends { eq: any }>(
  query: T,
  filters?: SalesFilters,
): T {
  if (!filters) return query;
  if (filters.cardType === 'physical' || filters.cardType === 'digital') {
    return query.eq('card_type', filters.cardType);
  }
  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyStatusFilter<T extends { in: any }>(
  query: T,
  filters?: SalesFilters,
): T {
  if (!filters) return query;
  if (filters.status === 'active' || filters.status === 'inactive') {
    return query.in('status', STATUS_FILTER_TO_DB[filters.status]);
  }
  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyDateFilters<T extends { gte: any; lte: any }>(
  query: T,
  filters: SalesFilters | undefined,
  tz: string,
): T {
  if (!filters) return query;

  // Sold date range (activated_at)
  if (filters.soldFrom) {
    query = query.gte('activated_at', zonedDayStartUTC(filters.soldFrom, tz));
  }
  if (filters.soldTo) {
    query = query.lte('activated_at', zonedDayEndUTC(filters.soldTo, tz));
  }

  // Assigned date range (assigned_at)
  if (filters.assignedFrom) {
    query = query.gte(
      'assigned_at',
      zonedDayStartUTC(filters.assignedFrom, tz),
    );
  }
  if (filters.assignedTo) {
    query = query.lte('assigned_at', zonedDayEndUTC(filters.assignedTo, tz));
  }

  return query;
}
