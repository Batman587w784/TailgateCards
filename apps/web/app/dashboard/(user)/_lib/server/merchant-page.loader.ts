import 'server-only';

import { cache } from 'react';

import { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import { Database } from '~/lib/database.types';

import { getUserMerchantId } from './role-guards';

const DEFAULT_PAGE_SIZE = 10;

export interface MerchantInfo {
  id: string;
  business_name: string;
  is_active: boolean;
}

export interface RedemptionRecord {
  id: string;
  card_code: string;
  discount_title: string;
  redeemed_at: string;
}

export interface MerchantStats {
  redemptions_today: number;
  redemptions_this_month: number;
  total_redemptions: number;
}

export interface MerchantDashboardData {
  merchant: MerchantInfo | null;
  redemptions: {
    data: RedemptionRecord[];
    count: number;
    pageCount: number;
  };
  stats: MerchantStats;
}

interface LoaderParams {
  page?: number;
  search?: string;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const loadMerchantDashboard = cache(merchantDashboardLoader);

async function merchantDashboardLoader(
  params: LoaderParams = {},
): Promise<MerchantDashboardData> {
  const {
    page = 1,
    search = '',
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy = 'redeemed_at',
    sortOrder = 'desc',
  } = params;

  const client = getSupabaseServerClient();
  const merchantAccountId = await getUserMerchantId();

  if (!merchantAccountId) {
    return emptyDashboardData();
  }

  // Fetch all data in parallel
  const [merchant, redemptionsData, stats] = await Promise.all([
    fetchMerchantInfo(client, merchantAccountId),
    fetchRedemptions(client, merchantAccountId, {
      page,
      search,
      pageSize,
      sortBy,
      sortOrder,
    }),
    fetchMerchantStats(client, merchantAccountId),
  ]);

  return {
    merchant,
    redemptions: redemptionsData,
    stats,
  };
}

async function fetchMerchantInfo(
  client: SupabaseClient<Database>,
  merchantAccountId: string,
): Promise<MerchantInfo | null> {
  const { data } = await client
    .from('merchant_profiles')
    .select('account_id, business_name, is_active')
    .eq('account_id', merchantAccountId)
    .single();

  if (!data) return null;

  return {
    id: data.account_id,
    business_name: data.business_name ?? 'Unknown Business',
    is_active: data.is_active,
  };
}

async function fetchRedemptions(
  client: SupabaseClient<Database>,
  merchantAccountId: string,
  params: {
    page: number;
    search: string;
    pageSize: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  },
): Promise<{ data: RedemptionRecord[]; count: number; pageCount: number }> {
  const { page, search, pageSize, sortBy, sortOrder } = params;
  const offset = (page - 1) * pageSize;

  // First get the count
  const countQuery = client
    .from('redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantAccountId);

  const { count: totalCount } = await countQuery;

  if (!totalCount || totalCount === 0) {
    return { data: [], count: 0, pageCount: 0 };
  }

  // Build the main query
  let query = client
    .from('redemptions')
    .select(
      `
      id,
      redeemed_at,
      card:cards!redemptions_card_id_fkey (
        id,
        card_type,
        card_number,
        digital_card_number,
        organization:accounts!cards_organization_id_fkey (
          card_prefix
        ),
        batch:batches!cards_batch_id_fkey (
          prefix
        )
      ),
      discount:discounts!redemptions_discount_id_fkey (
        title
      )
    `,
    )
    .eq('merchant_id', merchantAccountId);

  // Apply sorting
  const validSortColumns = ['redeemed_at', 'id'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'redeemed_at';
  query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

  // Apply pagination
  query = query.range(offset, offset + pageSize - 1);

  const { data } = await query;

  if (!data) {
    return {
      data: [],
      count: totalCount,
      pageCount: Math.ceil(totalCount / pageSize),
    };
  }

  type RedemptionCardJoin = {
    id: string;
    card_type: 'physical' | 'digital';
    card_number: number | null;
    digital_card_number: number | null;
    organization: { card_prefix: string | null } | null;
    batch: { prefix: string | null } | null;
  } | null;
  type RedemptionDiscountJoin = { title: string } | null;

  const buildCardCode = (card: RedemptionCardJoin): string => {
    if (!card) return 'N/A';

    return formatCardDisplayCode({
      card_type: card.card_type,
      card_number: card.card_number,
      digital_card_number: card.digital_card_number,
      organization_prefix: card.organization?.card_prefix ?? null,
      batch_prefix: card.batch?.prefix ?? null,
    });
  };

  // Filter by search if provided (client-side for now)
  let filteredData = data;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredData = data.filter((r) => {
      const cardCode = buildCardCode(r.card as RedemptionCardJoin);
      const discount = r.discount as RedemptionDiscountJoin;

      return (
        cardCode.toLowerCase().includes(searchLower) ||
        discount?.title.toLowerCase().includes(searchLower)
      );
    });
  }

  // Transform the data
  const redemptions: RedemptionRecord[] = filteredData.map((r) => {
    const cardCode = buildCardCode(r.card as RedemptionCardJoin);
    const discount = r.discount as RedemptionDiscountJoin;

    return {
      id: r.id,
      card_code: cardCode,
      discount_title: discount?.title ?? 'Unknown Discount',
      redeemed_at: r.redeemed_at,
    };
  });

  return {
    data: redemptions,
    count: totalCount,
    pageCount: Math.ceil(totalCount / pageSize),
  };
}

async function fetchMerchantStats(
  client: SupabaseClient<Database>,
  merchantAccountId: string,
): Promise<MerchantStats> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch all counts in parallel
  const [totalResult, todayResult, monthResult] = await Promise.all([
    client
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantAccountId),
    client
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantAccountId)
      .gte('redeemed_at', startOfToday.toISOString()),
    client
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantAccountId)
      .gte('redeemed_at', startOfMonth.toISOString()),
  ]);

  return {
    total_redemptions: totalResult.count ?? 0,
    redemptions_today: todayResult.count ?? 0,
    redemptions_this_month: monthResult.count ?? 0,
  };
}

function emptyDashboardData(): MerchantDashboardData {
  return {
    merchant: null,
    redemptions: {
      data: [],
      count: 0,
      pageCount: 0,
    },
    stats: {
      redemptions_today: 0,
      redemptions_this_month: 0,
      total_redemptions: 0,
    },
  };
}
