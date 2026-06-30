import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import { Database } from '~/lib/database.types';
import {
  getUserTimezone,
  zonedDayEndUTC,
  zonedDayStartUTC,
} from '~/lib/dates/zoned-day';

const DEFAULT_PAGE_SIZE = 10;

export type OrganizationWithAccount = {
  id: string;
  account_id: string;
  organization_name: string | null;
  organization_type: string | null;
  contact_phone: string | null;
  address: string | null;
  state: string | null;
  city: string | null;
  cash_payments_enabled: boolean;
  share_per_card_cents: number;
  is_active: boolean;
  created_at: string | null;
  total_revenue: number;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  account: {
    id: string;
    name: string;
    email: string | null;
    slug: string | null;
    created_at: string | null;
  };
};

export type OrganizationOption = {
  id: string;
  name: string;
  cardPrefix: string | null;
};

export type MerchantWithAccount = {
  id: string;
  account_id: string;
  business_name: string | null;
  business_type: string | null;
  contact_phone: string | null;
  address: string | null;
  state: string | null;
  city: string | null;
  stripe_account_id: string | null;
  is_active: boolean;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  created_at: string | null;
  total_redemptions: number;
  active_discounts: number;
  passcode: string | null;
  account: {
    id: string;
    name: string;
    email: string | null;
    slug: string | null;
    created_at: string | null;
    picture_url: string | null;
  };
};

export type CardholderData = {
  card_id: string;
  card_number: number | null;
  display_code: string;
  cardholder_id: string;
  cardholder_name: string | null;
  activation_date: string | null;
  expires_at: string | null;
  total_redemptions: number;
  last_used: string | null;
  card_status: 'Active' | 'Expired';
};

export type CardData = {
  id: string;
  card_number: number | null;
  display_code: string;
  card_type: 'physical' | 'digital';
  organization_id: string;
  organization_name: string;
  organization_prefix: string | null;
  status: 'pending' | 'paid' | 'activated' | 'expired' | 'cancelled';
  distributor_id: string | null;
  distributor_name: string | null;
  cardholder_id: string | null;
  created_at: string;
  activated_at: string | null;
  batch_id: string | null;
  batch_name: string | null;
};

export type BatchOption = {
  id: string;
  name: string;
};

export type DistributorOption = {
  id: string;
  name: string;
};

export type CardDateOption = {
  id: string;
  label: string;
};

export interface CardsFilterParams {
  status?: string[];
  batch?: string[];
  organization?: string[];
  distributor?: string[];
  dateCreated?: string[];
  cardType?: string[];
}

export type DistributorAccount = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  account_role: string;
  is_active: boolean;
  created_at: string | null;
  organization_name: string | null;
  total_sales: number;
  total_earnings_cents?: number;
  assigned_cards?: number;
  batch_count?: number;
};

export async function loadOrganizationsForSelect(
  client: SupabaseClient<Database>,
): Promise<OrganizationOption[]> {
  const { data, error } = await client
    .from('organization_profiles')
    .select(
      `
      account_id,
      organization_name,
      account:accounts!inner (
        card_prefix
      )
    `,
    )
    .eq('is_active', true)
    .order('organization_name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((org) => {
    const account = Array.isArray(org.account) ? org.account[0] : org.account;
    return {
      id: org.account_id,
      name: org.organization_name ?? 'Unnamed Organization',
      cardPrefix: account?.card_prefix ?? null,
    };
  });
}

// Map column IDs to actual database column names for each entity type
const organizationSortColumns: Record<string, string> = {
  organization_name: 'organization_name',
  is_active: 'is_active',
  created_at: 'created_at',
  total_revenue: 'created_at', // We can't sort by computed field, fall back to created_at
  cash_payments_enabled: 'cash_payments_enabled',
  state: 'state',
  city: 'city',
};

export async function loadOrganizations(
  client: SupabaseClient<Database>,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  query?: string,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
) {
  // First get count to avoid 416 errors
  let countQuery = client
    .from('organization_profiles')
    .select('id', { count: 'exact', head: true });

  if (query) {
    countQuery = countQuery.ilike('organization_name', `%${query}%`);
  }

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

  // Determine sort column
  const sortColumn =
    sortBy && organizationSortColumns[sortBy]
      ? organizationSortColumns[sortBy]
      : 'created_at';

  let queryBuilder = client
    .from('organization_profiles')
    .select(
      `
      id,
      account_id,
      organization_name,
      organization_type,
      contact_phone,
      address,
      state,
      city,
      cash_payments_enabled,
      share_per_card_cents,
      is_active,
      created_at,
      primary_contact_name,
      primary_contact_email,
      account:accounts!inner(id, name, email, slug, created_at)
    `,
    )
    .order(sortColumn, { ascending: sortOrder === 'asc' });

  if (query) {
    queryBuilder = queryBuilder.ilike('organization_name', `%${query}%`);
  }

  const { data, error } = await queryBuilder.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );

  if (error) {
    throw error;
  }

  // Fetch total revenue for each organization using the database function
  const orgsWithRevenue = await Promise.all(
    (data ?? []).map(async (org) => {
      const { data: revenueData } = await client.rpc(
        'get_organization_total_revenue',
        {
          org_account_id: org.account_id,
        },
      );
      return {
        ...org,
        total_revenue: Number(revenueData ?? 0),
      };
    }),
  );

  return {
    data: orgsWithRevenue as unknown as OrganizationWithAccount[],
    count: safeCount,
    pageCount,
  };
}

const merchantSortColumns: Record<string, string> = {
  business_name: 'business_name',
  is_active: 'is_active',
  created_at: 'created_at',
  total_redemptions: 'created_at',
  active_discounts: 'created_at',
  state: 'state',
  city: 'city',
};

export async function loadMerchants(
  client: SupabaseClient<Database>,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  query?: string,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
) {
  // First get count to avoid 416 errors
  let countQuery = client
    .from('merchant_profiles')
    .select('id', { count: 'exact', head: true });

  if (query) {
    countQuery = countQuery.ilike('business_name', `%${query}%`);
  }

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
    sortBy && merchantSortColumns[sortBy]
      ? merchantSortColumns[sortBy]
      : 'created_at';

  let queryBuilder = client
    .from('merchant_profiles')
    .select(
      `
      id,
      account_id,
      business_name,
      business_type,
      contact_phone,
      address,
      state,
      city,
      stripe_account_id,
      is_active,
      primary_contact_name,
      primary_contact_email,
      created_at,
      passcode,
      account:accounts!inner(id, name, email, slug, created_at, picture_url)
    `,
    )
    .order(sortColumn, { ascending: sortOrder === 'asc' });

  if (query) {
    queryBuilder = queryBuilder.ilike('business_name', `%${query}%`);
  }

  const { data, error } = await queryBuilder.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );

  if (error) {
    throw error;
  }

  // Fetch stats for each merchant using database functions
  const merchantsWithStats = await Promise.all(
    (data ?? []).map(async (merchant) => {
      const [redemptionsResult, discountsResult] = await Promise.all([
        client.rpc('get_merchant_total_redemptions', {
          merchant_account_id: merchant.account_id,
        }),
        client.rpc('get_merchant_active_discounts', {
          merchant_account_id: merchant.account_id,
        }),
      ]);
      return {
        ...merchant,
        total_redemptions: Number(redemptionsResult.data ?? 0),
        active_discounts: Number(discountsResult.data ?? 0),
      };
    }),
  );

  return {
    data: merchantsWithStats as unknown as MerchantWithAccount[],
    count: safeCount,
    pageCount,
  };
}

const distributorSortColumns: Record<string, string> = {
  name: 'name',
  email: 'email',
  is_active: 'is_active',
  created_at: 'created_at',
  total_sales: 'created_at',
  organization_name: 'created_at',
};

export async function loadDistributors(
  client: SupabaseClient<Database>,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  query?: string,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
) {
  // First get count to avoid 416 errors
  let countQuery = client
    .from('distributors_view')
    .select('id', { count: 'exact', head: true });

  if (query) {
    countQuery = countQuery.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
  }

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
    sortBy && distributorSortColumns[sortBy]
      ? distributorSortColumns[sortBy]
      : 'created_at';

  // Use distributors_view which joins accounts with memberships
  let queryBuilder = client
    .from('distributors_view')
    .select('id, name, email, phone, account_role, is_active, created_at')
    .order(sortColumn, { ascending: sortOrder === 'asc' });

  if (query) {
    queryBuilder = queryBuilder.or(
      `name.ilike.%${query}%,email.ilike.%${query}%`,
    );
  }

  const { data, error } = await queryBuilder.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );

  if (error) {
    throw error;
  }

  // Fetch stats for each distributor using database functions
  // Filter out any rows with null id (shouldn't happen but TypeScript requires it)
  const validDistributors = (data ?? []).filter(
    (d): d is typeof d & { id: string } => d.id !== null,
  );

  const distributorsWithStats = await Promise.all(
    validDistributors.map(async (distributor) => {
      const [salesResult, orgNameResult, batchCountResult, revenueResult] =
        await Promise.all([
          client.rpc('get_distributor_total_sales', {
            distributor_account_id: distributor.id,
          }),
          client.rpc('get_distributor_organization_name', {
            distributor_account_id: distributor.id,
          }),
          client.rpc('get_distributor_batch_count', {
            distributor_account_id: distributor.id,
          }),
          client.rpc('get_distributor_total_revenue', {
            distributor_account_id: distributor.id,
          }),
        ]);
      return {
        id: distributor.id,
        name: distributor.name ?? '',
        email: distributor.email,
        phone: distributor.phone,
        account_role: distributor.account_role ?? 'distributor',
        is_active: distributor.is_active ?? true,
        created_at: distributor.created_at,
        total_sales: Number(salesResult.data ?? 0),
        organization_name: orgNameResult.data as string | null,
        batch_count: Number(batchCountResult.data ?? 0),
        total_earnings_cents: Number(revenueResult.data ?? 0),
      };
    }),
  );

  return {
    data: distributorsWithStats as DistributorAccount[],
    count: safeCount,
    pageCount,
  };
}

const cardholderSortColumns: Record<string, string> = {
  card_id: 'id',
  card_number: 'card_number',
  expiry_date: 'expires_at',
  activation_date: 'activated_at',
  total_redemptions: 'activated_at',
  last_used: 'activated_at',
  card_status: 'status',
};

export async function loadCardholders(
  client: SupabaseClient<Database>,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  query?: string,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
) {
  // Accept "123", "D-000123", or "D123" — search both card_number (physical)
  // and digital_card_number (digital).
  const numericQuery = query ? parseInt(query.replace(/^d-?/i, ''), 10) : NaN;
  const numericFilter = !isNaN(numericQuery)
    ? `card_number.eq.${numericQuery},digital_card_number.eq.${numericQuery}`
    : null;

  // First get count to avoid 416 errors
  let countQuery = client
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .not('cardholder_id', 'is', null);

  if (numericFilter) {
    countQuery = countQuery.or(numericFilter);
  }

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
    sortBy && cardholderSortColumns[sortBy]
      ? cardholderSortColumns[sortBy]
      : 'activated_at';

  // Query cards with cardholder info for the table display
  let queryBuilder = (client as SupabaseClient)
    .from('cards')
    .select(
      `
      id,
      card_number,
      card_type,
      digital_card_number,
      cardholder_id,
      activated_at,
      expires_at,
      status,
      organization:accounts!cards_organization_id_fkey(id, name, card_prefix),
      batch:batches(id, prefix)
    `,
    )
    .not('cardholder_id', 'is', null)
    .order(sortColumn, { ascending: sortOrder === 'asc', nullsFirst: false });

  if (numericFilter) {
    queryBuilder = queryBuilder.or(numericFilter);
  }

  const { data, error } = await queryBuilder.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );

  if (error) {
    throw error;
  }

  // Fetch stats for each cardholder and determine card status
  const cardholdersWithStats = await Promise.all(
    (data ?? []).map(async (card) => {
      const [redemptionsResult, lastUsedResult, cardholderResult] =
        await Promise.all([
          client.rpc('get_cardholder_total_redemptions', {
            cardholder_account_id: card.cardholder_id!,
          }),
          client.rpc('get_cardholder_last_used', {
            cardholder_account_id: card.cardholder_id!,
          }),
          client
            .from('accounts')
            .select('name')
            .eq('id', card.cardholder_id!)
            .single(),
        ]);

      // Determine card status based on expiry date
      const isExpired = card.expires_at
        ? new Date(card.expires_at) < new Date()
        : false;
      const cardStatus: 'Active' | 'Expired' =
        isExpired || card.status === 'expired' || card.status === 'cancelled'
          ? 'Expired'
          : 'Active';

      // Get organization and batch data for display code
      type OrgType = { id: string; name: string; card_prefix: string | null };
      type BatchType = { id: string; prefix: string | null };
      const orgData = card.organization as OrgType | OrgType[] | null;
      const batchData = card.batch as BatchType | BatchType[] | null;
      const org = Array.isArray(orgData) ? orgData[0] : orgData;
      const batch = Array.isArray(batchData) ? batchData[0] : batchData;

      const displayCode = formatCardDisplayCode({
        card_type: card.card_type,
        card_number: card.card_number,
        digital_card_number: card.digital_card_number,
        organization_prefix: org?.card_prefix ?? null,
        batch_prefix: batch?.prefix ?? null,
      });

      return {
        card_id: card.id,
        card_number: card.card_number,
        display_code: displayCode,
        cardholder_id: card.cardholder_id!,
        cardholder_name: cardholderResult.data?.name ?? null,
        activation_date: card.activated_at,
        expires_at: card.expires_at,
        total_redemptions: Number(redemptionsResult.data ?? 0),
        last_used: lastUsedResult.data as string | null,
        card_status: cardStatus,
      };
    }),
  );

  return {
    data: cardholdersWithStats as CardholderData[],
    count: safeCount,
    pageCount,
  };
}

const cardSortColumns: Record<string, string> = {
  display_code: 'card_number',
  card_number: 'card_number',
  organization_name: 'organization_id',
  status: 'status',
  distributor_name: 'distributor_id',
  created_at: 'created_at',
  activated_at: 'activated_at',
};

// Maps display status to database status values for filtering
const STATUS_TO_DB_MAP: Record<string, string[]> = {
  active: ['activated'],
  expired: ['expired'],
  inactive: ['pending', 'paid', 'cancelled'],
};

export async function loadBatchesForFilter(
  client: SupabaseClient<Database>,
): Promise<BatchOption[]> {
  // Note: 'batches' table types will be available after running typegen
  const { data, error } = await (client as SupabaseClient)
    .from('batches')
    .select('id, name')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data as Array<{ id: string; name: string }>) ?? []).map((batch) => ({
    id: batch.id,
    name: batch.name,
  }));
}

export async function loadDistributorsForFilter(
  client: SupabaseClient<Database>,
): Promise<DistributorOption[]> {
  const { data, error } = await client
    .from('distributors_view')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .filter(
      (d): d is typeof d & { id: string; name: string } =>
        d.id !== null && d.name !== null,
    )
    .map((d) => ({
      id: d.id,
      name: d.name,
    }));
}

export async function loadCardDatesForFilter(
  client: SupabaseClient<Database>,
): Promise<CardDateOption[]> {
  const { data, error } = await client
    .from('cards')
    .select('created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Get unique dates
  const uniqueDates = new Set<string>();
  (data ?? []).forEach((card) => {
    if (card.created_at) {
      const date = new Date(card.created_at).toISOString().split('T')[0];
      if (date) {
        uniqueDates.add(date);
      }
    }
  });

  return Array.from(uniqueDates).map((date) => ({
    id: date,
    label: new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  }));
}

export async function loadCards(
  client: SupabaseClient<Database>,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  query?: string,
  organizationId?: string,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
  filters?: CardsFilterParams,
) {
  // First get count to avoid 416 errors
  let countQuery = client
    .from('cards')
    .select('id', { count: 'exact', head: true });

  if (organizationId) {
    countQuery = countQuery.eq('organization_id', organizationId);
  }

  const tz = await getUserTimezone();

  // Apply filters to count query
  applyCardFilters(countQuery, filters, tz);

  // Note: For text searches, we skip count query filtering
  // Count will be calculated after fetching and filtering results

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
    sortBy && cardSortColumns[sortBy] ? cardSortColumns[sortBy] : 'created_at';

  // Note: batch_id and batch join will work after migration is applied and types regenerated
  // Using type assertion to bypass strict typing until then.
  // card_type and digital_card_number columns are added by migration
  // 20260508100446 — typed as unknown until typegen runs.
  const queryBuilder = (client as SupabaseClient)
    .from('cards')
    .select(
      `
      id,
      card_number,
      card_type,
      digital_card_number,
      status,
      distributor_id,
      cardholder_id,
      created_at,
      activated_at,
      organization_id,
      batch_id,
      organization:accounts!cards_organization_id_fkey(id, name, card_prefix),
      batch:batches(id, name, prefix)
    `,
    )
    .order(sortColumn, { ascending: sortOrder === 'asc' });

  if (organizationId) {
    queryBuilder.eq('organization_id', organizationId);
  }

  // Search will be applied after fetching (client-side filtering for flexibility)
  const searchQuery = query?.trim();

  // Apply filters to main query
  applyCardFilters(queryBuilder, filters, tz);

  // When searching, fetch all records for client-side filtering
  // Otherwise, use pagination
  const MAX_SEARCH_RESULTS = 1000; // Limit for search queries
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
    distributor_id: string | null;
    cardholder_id: string | null;
    created_at: string;
    activated_at: string | null;
    organization_id: string;
    batch_id: string | null;
    organization: {
      id: string;
      name: string;
      card_prefix: string | null;
    } | null;
    batch: { id: string; name: string; prefix: string | null } | null;
  };

  // Transform data to include display_code and fetch distributor names
  const cardsWithDetails = await Promise.all(
    ((data as unknown as CardQueryResult[]) ?? []).map(async (card) => {
      const org = card.organization;
      const batch = card.batch;

      // Fetch distributor name if exists
      let distributorName: string | null = null;
      if (card.distributor_id) {
        const { data: distributor } = await client
          .from('accounts')
          .select('name')
          .eq('id', card.distributor_id)
          .single();
        distributorName = distributor?.name ?? null;
      }

      const displayCode = formatCardDisplayCode({
        card_type: card.card_type,
        card_number: card.card_number,
        digital_card_number: card.digital_card_number,
        organization_prefix: org?.card_prefix ?? null,
        batch_prefix: batch?.prefix ?? null,
      });

      return {
        id: card.id,
        card_number: card.card_number,
        display_code: displayCode,
        card_type: card.card_type,
        organization_id: card.organization_id,
        organization_name: org?.name ?? 'Unknown',
        organization_prefix: org?.card_prefix ?? null,
        status: card.status as CardData['status'],
        distributor_id: card.distributor_id,
        distributor_name: distributorName,
        cardholder_id: card.cardholder_id,
        created_at: card.created_at,
        activated_at: card.activated_at,
        batch_id: card.batch_id,
        batch_name: batch?.name ?? null,
      };
    }),
  );

  // Apply search filter
  let filteredCards = cardsWithDetails as CardData[];
  if (searchQuery) {
    const lowerQuery = searchQuery.toLowerCase();
    const dashCount = (searchQuery.match(/-/g) || []).length;

    if (dashCount >= 2) {
      // Two or more dashes: exact match on display_code (e.g., "ACME-SPR25-123")
      filteredCards = filteredCards.filter(
        (card) => card.display_code.toLowerCase() === lowerQuery,
      );
    } else {
      // Partial match: search across display_code, org name, batch name
      filteredCards = filteredCards.filter(
        (card) =>
          card.display_code.toLowerCase().includes(lowerQuery) ||
          card.organization_name.toLowerCase().includes(lowerQuery) ||
          (card.batch_name?.toLowerCase().includes(lowerQuery) ?? false),
      );
    }

    // Apply pagination to filtered results
    const filteredCount = filteredCards.length;
    const filteredPageCount = Math.ceil(filteredCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedCards = filteredCards.slice(
      startIndex,
      startIndex + pageSize,
    );

    return {
      data: paginatedCards,
      count: filteredCount,
      pageCount: filteredPageCount,
    };
  }

  return {
    data: filteredCards,
    count: safeCount,
    pageCount,
  };
}

export function applyCardFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: CardsFilterParams | undefined,
  tz: string,
): void {
  if (!filters) return;

  // Status filter (with mapping)
  if (filters.status?.length) {
    const dbStatuses: string[] = [];
    filters.status.forEach((status) => {
      const mapped = STATUS_TO_DB_MAP[status];
      if (mapped) {
        dbStatuses.push(...mapped);
      }
    });
    if (dbStatuses.length) {
      query.in('status', dbStatuses);
    }
  }

  // Batch filter
  if (filters.batch?.length) {
    query.in('batch_id', filters.batch);
  }

  // Organization filter
  if (filters.organization?.length) {
    query.in('organization_id', filters.organization);
  }

  // Distributor filter
  if (filters.distributor?.length) {
    query.in('distributor_id', filters.distributor);
  }

  // Date created filter
  if (filters.dateCreated?.length) {
    // Filter by date (ignoring time) using OR conditions
    const dateConditions = filters.dateCreated
      .map((date) => {
        const startOfDay = zonedDayStartUTC(date, tz);
        const endOfDay = zonedDayEndUTC(date, tz);
        return `and(created_at.gte.${startOfDay},created_at.lte.${endOfDay})`;
      })
      .join(',');
    query.or(dateConditions);
  }

  // Card type filter (physical / digital).
  if (filters.cardType?.length) {
    query.in('card_type', filters.cardType);
  }
}

export type MerchantOption = {
  id: string;
  name: string;
  city: string | null;
};

export async function loadMerchantsForSelect(
  client: SupabaseClient<Database>,
): Promise<MerchantOption[]> {
  const { data, error } = await client
    .from('merchant_profiles')
    .select('account_id, business_name, city')
    .eq('is_active', true)
    .order('business_name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((merchant) => ({
    id: merchant.account_id,
    name: merchant.business_name ?? 'Unnamed Merchant',
    city: merchant.city,
  }));
}

export async function loadOrganizationMerchantPartners(
  client: SupabaseClient<Database>,
  organizationId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from('organization_merchant_partnerships')
    .select('merchant_id')
    .eq('organization_id', organizationId);

  if (error) throw error;

  return (data ?? []).map((p) => p.merchant_id);
}
