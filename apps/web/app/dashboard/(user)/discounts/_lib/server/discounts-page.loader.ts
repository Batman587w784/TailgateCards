import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

const DEFAULT_PAGE_SIZE = 10;

export type DiscountWithMerchant = {
  id: string;
  title: string;
  description: string | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string | null;
  redemption_count: number;
  merchant: {
    account_id: string;
    business_name: string | null;
    address: string | null;
    city: string | null;
  };
};

export type MerchantOption = {
  id: string;
  name: string;
  city: string | null;
  hasDiscount: boolean;
};

export async function loadMerchantsForSelect(
  client: SupabaseClient<Database>,
): Promise<MerchantOption[]> {
  // Get all active merchants
  const { data: merchants, error: merchantsError } = await client
    .from('merchant_profiles')
    .select('account_id, business_name, city')
    .eq('is_active', true)
    .order('business_name', { ascending: true });

  if (merchantsError) throw merchantsError;

  // Get all merchant IDs that have active discounts
  const { data: discountedMerchants, error: discountsError } = await client
    .from('discounts')
    .select('merchant_id')
    .eq('is_active', true);

  if (discountsError) throw discountsError;

  const merchantsWithDiscounts = new Set(
    (discountedMerchants ?? []).map((d) => d.merchant_id),
  );

  return (merchants ?? []).map((merchant) => ({
    id: merchant.account_id,
    name: merchant.business_name ?? 'Unnamed Merchant',
    city: merchant.city,
    hasDiscount: merchantsWithDiscounts.has(merchant.account_id),
  }));
}

export async function loadDiscounts(
  client: SupabaseClient<Database>,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  query?: string,
) {
  // When searching, also find merchants matching the query by business name
  let matchingMerchantIds: string[] = [];

  if (query) {
    const { data: matchingMerchants } = await client
      .from('merchant_profiles')
      .select('account_id')
      .ilike('business_name', `%${query}%`);

    matchingMerchantIds = (matchingMerchants ?? []).map((m) => m.account_id);
  }

  // First get count to avoid 416 errors
  let countQuery = client
    .from('discounts')
    .select('id', { count: 'exact', head: true });

  if (query) {
    if (matchingMerchantIds.length > 0) {
      countQuery = countQuery.or(
        `title.ilike.%${query}%,merchant_id.in.(${matchingMerchantIds.join(',')})`,
      );
    } else {
      countQuery = countQuery.ilike('title', `%${query}%`);
    }
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

  // Query discounts (organization_id removed - now city-based)
  let queryBuilder = client
    .from('discounts')
    .select(
      `
      id,
      title,
      description,
      valid_from,
      valid_until,
      is_active,
      created_at,
      merchant_id
    `,
    )
    .order('created_at', { ascending: false });

  if (query) {
    if (matchingMerchantIds.length > 0) {
      queryBuilder = queryBuilder.or(
        `title.ilike.%${query}%,merchant_id.in.(${matchingMerchantIds.join(',')})`,
      );
    } else {
      queryBuilder = queryBuilder.ilike('title', `%${query}%`);
    }
  }

  const { data, error } = await queryBuilder.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );

  if (error) {
    throw error;
  }

  // Fetch merchant profiles and redemption counts for each discount
  // Note: organization removed - discounts are now city-based via merchant's city
  const discountsWithMerchants = await Promise.all(
    (data ?? []).map(async (discount) => {
      const [merchantResult, redemptionResult] = await Promise.all([
        client
          .from('merchant_profiles')
          .select('account_id, business_name, address, city')
          .eq('account_id', discount.merchant_id)
          .single(),
        client.rpc('get_discount_redemption_count', {
          discount_uuid: discount.id,
        }),
      ]);

      return {
        id: discount.id,
        title: discount.title,
        description: discount.description,
        valid_from: discount.valid_from,
        valid_until: discount.valid_until,
        is_active: discount.is_active,
        created_at: discount.created_at,
        redemption_count: Number(redemptionResult.data ?? 0),
        merchant: merchantResult.data ?? {
          account_id: discount.merchant_id,
          business_name: null,
          address: null,
          city: null,
        },
      };
    }),
  );

  return {
    data: discountsWithMerchants as DiscountWithMerchant[],
    count: safeCount,
    pageCount,
  };
}
