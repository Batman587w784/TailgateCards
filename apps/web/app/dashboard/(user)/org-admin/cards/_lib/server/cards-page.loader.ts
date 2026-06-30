import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import { Database } from '~/lib/database.types';
import {
  getUserTimezone,
  zonedDayEndUTC,
  zonedDayStartUTC,
} from '~/lib/dates/zoned-day';

import type { CardsFilters } from '../types/cards-filter.types';

export type CardStatus =
  | 'pending'
  | 'paid'
  | 'activated'
  | 'expired'
  | 'cancelled';

const DEFAULT_PAGE_SIZE = 10;

export type OrgCard = {
  id: string;
  display_code: string;
  card_number: number | null;
  status: CardStatus;
  batch_id: string | null;
  batch_prefix: string | null;
  org_prefix: string | null;
  distributor_id: string | null;
  distributor_name: string | null;
  assigned_at: string | null;
  activated_at: string | null;
  cardholder_id: string | null;
  cardholder_name: string | null;
};

export type DistributorOption = {
  id: string;
  name: string;
};

export async function loadOrgCards(
  client: SupabaseClient<Database>,
  orgId: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  query?: string,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
  filters?: CardsFilters,
) {
  const sortColumn =
    sortBy === 'display_code'
      ? 'card_number'
      : sortBy === 'batch'
        ? 'batch_id'
        : 'created_at';
  const ascending = sortOrder === 'asc';

  const tz = await getUserTimezone();
  const createdFromUTC = filters?.createdFrom
    ? zonedDayStartUTC(filters.createdFrom, tz)
    : null;
  const createdToUTC = filters?.createdTo
    ? zonedDayEndUTC(filters.createdTo, tz)
    : null;

  // Build count query first
  let countQuery = client
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  // Note: We can't filter by display_code in the DB query since it's computed
  // We'll handle search filtering after fetching data

  if (filters?.statuses && filters.statuses.length > 0) {
    countQuery = countQuery.in(
      'status',
      filters.statuses as Database['public']['Enums']['card_status'][],
    );
  }

  if (filters?.distributors && filters.distributors.length > 0) {
    // Handle 'unassigned' special case
    const hasUnassigned = filters.distributors.includes('unassigned');
    const distributorIds = filters.distributors.filter(
      (d) => d !== 'unassigned',
    );

    if (hasUnassigned && distributorIds.length > 0) {
      // Both unassigned and specific distributors - use OR logic
      countQuery = countQuery.or(
        `distributor_id.is.null,distributor_id.in.(${distributorIds.join(',')})`,
      );
    } else if (hasUnassigned) {
      countQuery = countQuery.is('distributor_id', null);
    } else {
      countQuery = countQuery.in('distributor_id', distributorIds);
    }
  }

  if (createdFromUTC) {
    countQuery = countQuery.gte('created_at', createdFromUTC);
  }

  if (createdToUTC) {
    countQuery = countQuery.lte('created_at', createdToUTC);
  }

  const { count: totalCount } = await countQuery;
  const pageCount = Math.ceil((totalCount ?? 0) / pageSize);

  // If page exceeds pageCount, return empty
  if (page > pageCount && pageCount > 0) {
    return { data: [], count: totalCount ?? 0, pageCount };
  }

  // Build data query with secondary sort by id for stable ordering
  let dataQuery = client
    .from('cards')
    .select(
      'id, card_number, card_type, digital_card_number, status, batch_id, distributor_id, created_at, assigned_at, activated_at, cardholder_id',
    )
    .eq('organization_id', orgId)
    .order(sortColumn, { ascending })
    .order('id', { ascending: true });

  if (filters?.statuses && filters.statuses.length > 0) {
    dataQuery = dataQuery.in(
      'status',
      filters.statuses as Database['public']['Enums']['card_status'][],
    );
  }

  if (filters?.distributors && filters.distributors.length > 0) {
    const hasUnassigned = filters.distributors.includes('unassigned');
    const distributorIds = filters.distributors.filter(
      (d) => d !== 'unassigned',
    );

    if (hasUnassigned && distributorIds.length > 0) {
      dataQuery = dataQuery.or(
        `distributor_id.is.null,distributor_id.in.(${distributorIds.join(',')})`,
      );
    } else if (hasUnassigned) {
      dataQuery = dataQuery.is('distributor_id', null);
    } else {
      dataQuery = dataQuery.in('distributor_id', distributorIds);
    }
  }

  if (createdFromUTC) {
    dataQuery = dataQuery.gte('created_at', createdFromUTC);
  }

  if (createdToUTC) {
    dataQuery = dataQuery.lte('created_at', createdToUTC);
  }

  const { data, error } = await dataQuery.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );

  if (error) throw error;

  // Fetch organization prefix
  const { data: orgData } = await client
    .from('accounts')
    .select('card_prefix')
    .eq('id', orgId)
    .single();

  const orgPrefix = orgData?.card_prefix ?? null;

  // Fetch batch, distributor, and cardholder info for the cards
  const batchIds = [
    ...new Set((data ?? []).map((c) => c.batch_id).filter(Boolean)),
  ] as string[];
  const distributorIds = [
    ...new Set((data ?? []).map((c) => c.distributor_id).filter(Boolean)),
  ] as string[];
  const cardholderIds = [
    ...new Set((data ?? []).map((c) => c.cardholder_id).filter(Boolean)),
  ] as string[];

  // Fetch batches
  const batchesMap = new Map<string, { prefix: string | null; name: string }>();
  if (batchIds.length > 0) {
    const { data: batches } = await client
      .from('batches')
      .select('id, prefix, name')
      .in('id', batchIds);

    (batches ?? []).forEach((b) => {
      batchesMap.set(b.id, { prefix: b.prefix, name: b.name });
    });
  }

  // Fetch distributors
  const distributorsMap = new Map<string, string>();
  if (distributorIds.length > 0) {
    const { data: distributors } = await client
      .from('accounts')
      .select('id, name')
      .in('id', distributorIds);

    (distributors ?? []).forEach((d) => {
      distributorsMap.set(d.id, d.name ?? 'Unknown');
    });
  }

  // Fetch cardholders
  const cardholdersMap = new Map<string, string>();
  if (cardholderIds.length > 0) {
    const { data: cardholders } = await client
      .from('accounts')
      .select('id, name')
      .in('id', cardholderIds);

    (cardholders ?? []).forEach((c) => {
      cardholdersMap.set(c.id, c.name ?? 'Unknown');
    });
  }

  // Filter by batch prefixes if specified
  let filteredData = data ?? [];
  if (filters?.batchPrefixes && filters.batchPrefixes.length > 0) {
    filteredData = filteredData.filter((card) => {
      if (!card.batch_id) return false;
      const batch = batchesMap.get(card.batch_id);
      return batch?.prefix && filters.batchPrefixes.includes(batch.prefix);
    });
  }

  // Map cards with batch, distributor, and cardholder info
  const cardsWithDetails: OrgCard[] = filteredData.map((card) => {
    const batch = card.batch_id ? batchesMap.get(card.batch_id) : null;

    const displayCode = formatCardDisplayCode({
      card_type: card.card_type,
      card_number: card.card_number,
      digital_card_number: card.digital_card_number,
      organization_prefix: orgPrefix,
      batch_prefix: batch?.prefix ?? null,
    });

    return {
      id: card.id,
      display_code: displayCode,
      card_number: card.card_number,
      status: card.status as CardStatus,
      batch_id: card.batch_id,
      batch_prefix: batch?.prefix ?? null,
      org_prefix: orgPrefix,
      distributor_id: card.distributor_id,
      distributor_name: card.distributor_id
        ? (distributorsMap.get(card.distributor_id) ?? null)
        : null,
      assigned_at: card.assigned_at,
      activated_at: card.activated_at,
      cardholder_id: card.cardholder_id,
      cardholder_name: card.cardholder_id
        ? (cardholdersMap.get(card.cardholder_id) ?? null)
        : null,
    };
  });

  // Apply search query filtering on display_code
  let searchFilteredCards = cardsWithDetails;
  if (query) {
    const lowerQuery = query.toLowerCase();
    searchFilteredCards = cardsWithDetails.filter(
      (card) =>
        card.display_code.toLowerCase().includes(lowerQuery) ||
        (card.card_number?.toString().includes(lowerQuery) ?? false),
    );
  }

  return {
    data: searchFilteredCards,
    count: query ? searchFilteredCards.length : (totalCount ?? 0),
    pageCount: query
      ? Math.ceil(searchFilteredCards.length / pageSize)
      : pageCount,
  };
}

export async function loadDistributorsForFilter(
  client: SupabaseClient<Database>,
  orgId: string,
): Promise<DistributorOption[]> {
  const { data, error } = await client
    .from('distributors_view')
    .select('id, name')
    .eq('organization_id', orgId)
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .filter((d): d is typeof d & { id: string } => d.id !== null)
    .map((d) => ({
      id: d.id,
      name: d.name ?? 'Unnamed Distributor',
    }));
}

export async function loadBatchPrefixes(
  client: SupabaseClient<Database>,
  orgId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from('batches')
    .select('prefix')
    .eq('organization_id', orgId)
    .not('prefix', 'is', null)
    .order('prefix', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .filter((b): b is typeof b & { prefix: string } => b.prefix !== null)
    .map((b) => b.prefix);
}

export async function loadUnassignedCardCount(
  client: SupabaseClient<Database>,
  orgId: string,
): Promise<number> {
  const { count, error } = await client
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('distributor_id', null);

  if (error) throw error;

  return count ?? 0;
}
