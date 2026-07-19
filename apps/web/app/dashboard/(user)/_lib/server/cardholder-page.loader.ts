import 'server-only';

import { cache } from 'react';

import { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import { Database } from '~/lib/database.types';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

type CardStatus = Database['public']['Enums']['card_status'];

export interface CardholderCard {
  id: string;
  display_code: string;
  status: CardStatus;
  // Derived from expires_at (ledger #22) — nothing writes status='expired', so
  // the status flag alone would show a lapsed card as active.
  is_expired: boolean;
  expires_at: string | null;
  organization: {
    id: string;
    name: string;
    // The org's buy-page slug, for the "Renew" CTA (buy a new card for the
    // same chapter). Null if the org has no slug.
    slug: string | null;
  };
}

export interface DiscountWithMerchant {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  valid_until: string | null;
  merchant: {
    id: string;
    business_name: string;
    address: string | null;
    city: string | null;
    picture_url: string | null;
  };
}

export interface ActiveDiscountWithUsage extends DiscountWithMerchant {
  usageCount: number;
}

export interface RedeemedDiscount {
  id: string;
  title: string;
  category: string | null;
  redeemed_at: string;
  merchant: {
    id: string;
    business_name: string;
    address: string | null;
    city: string | null;
    picture_url: string | null;
  };
}

export interface CardholderStats {
  discountsUsed: number;
  daysRemaining: number;
}

export interface CardholderWalletStatus {
  appleAddedAt: string | null;
  googleAddedAt: string | null;
}

export interface CardholderDashboardData {
  card: CardholderCard | null;
  stats: CardholderStats;
  discounts: {
    active: ActiveDiscountWithUsage[];
    expired: DiscountWithMerchant[];
    redeemed: RedeemedDiscount[];
  };
  walletStatus: CardholderWalletStatus;
}

export const loadCardholderDashboard = cache(cardholderDashboardLoader);

async function cardholderDashboardLoader(): Promise<CardholderDashboardData> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  // Fetch cardholder's personal account ID
  const { data: personalAccount, error } = await client
    .from('accounts')
    .select('id')
    .eq('primary_owner_user_id', user.id)
    .eq('is_personal_account', true)
    .single();

  if (error) {
    // PGRST116 = No rows found (expected for non-cardholders)
    if (error.code === 'PGRST116') {
      return emptyDashboardData();
    }
    throw error;
  }

  if (!personalAccount) {
    return emptyDashboardData();
  }

  const cardholderAccountId = personalAccount.id;

  // Fetch all data in parallel
  const [card, redemptions, allDiscounts, walletStatus] = await Promise.all([
    fetchCardholderCard(client, cardholderAccountId),
    fetchRedemptions(client, cardholderAccountId),
    fetchDiscounts(client),
    fetchWalletStatus(client, cardholderAccountId),
  ]);

  // Calculate stats
  const stats = calculateStats(card, redemptions);

  // Categorize discounts
  const categorizedDiscounts = categorizeDiscounts(allDiscounts, redemptions);

  return {
    card,
    stats,
    discounts: categorizedDiscounts,
    walletStatus,
  };
}

async function fetchWalletStatus(
  client: SupabaseClient<Database>,
  cardholderAccountId: string,
): Promise<CardholderWalletStatus> {
  const { data } = await client
    .from('cardholder_profiles')
    .select('apple_wallet_added_at, google_wallet_added_at')
    .eq('account_id', cardholderAccountId)
    .maybeSingle();

  return {
    appleAddedAt: data?.apple_wallet_added_at ?? null,
    googleAddedAt: data?.google_wallet_added_at ?? null,
  };
}

async function fetchCardholderCard(
  client: SupabaseClient<Database>,
  cardholderAccountId: string,
): Promise<CardholderCard | null> {
  const { data } = await client
    .from('cards')
    .select(
      `
      id,
      card_type,
      card_number,
      digital_card_number,
      status,
      expires_at,
      organization:accounts!cards_organization_id_fkey (
        id,
        name,
        slug,
        card_prefix
      ),
      batch:batches!cards_batch_id_fkey (
        prefix
      )
    `,
    )
    .eq('cardholder_id', cardholderAccountId)
    .eq('status', 'activated')
    .order('activated_at', { ascending: false })
    .limit(1)
    .single();

  if (!data || !data.organization) {
    return null;
  }

  const org = data.organization as {
    id: string;
    name: string;
    slug: string | null;
    card_prefix: string | null;
  };
  const batch = data.batch as { prefix: string } | null;

  const displayCode = formatCardDisplayCode({
    card_type: data.card_type,
    card_number: data.card_number,
    digital_card_number: data.digital_card_number,
    organization_prefix: org.card_prefix,
    batch_prefix: batch?.prefix ?? null,
  });

  return {
    id: data.id,
    display_code: displayCode,
    status: data.status,
    is_expired:
      data.expires_at !== null && new Date(data.expires_at) < new Date(),
    expires_at: data.expires_at,
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
    },
  };
}

interface RedemptionWithDetails {
  id: string;
  status: Database['public']['Enums']['redemption_status'];
  redeemed_at: string;
  card_id: string;
  discount: {
    id: string;
    title: string;
    category: string | null;
  };
  merchant: {
    id: string;
    business_name: string | null;
    address: string | null;
    city: string | null;
    picture_url: string | null;
  };
}

async function fetchRedemptions(
  client: SupabaseClient<Database>,
  cardholderAccountId: string,
): Promise<RedemptionWithDetails[]> {
  // Get card IDs for this cardholder
  const { data: cards } = await client
    .from('cards')
    .select('id')
    .eq('cardholder_id', cardholderAccountId);

  if (!cards || cards.length === 0) {
    return [];
  }

  const cardIds = cards.map((c) => c.id);

  const { data } = await client
    .from('redemptions')
    .select(
      `
      id,
      status,
      redeemed_at,
      card_id,
      merchant_id,
      discount:discounts (
        id,
        title,
        category
      )
    `,
    )
    .in('card_id', cardIds)
    .order('redeemed_at', { ascending: false });

  if (!data) {
    return [];
  }

  // Fetch merchant profiles for all unique merchant IDs
  const merchantIds = [...new Set(data.map((r) => r.merchant_id))];
  const { data: merchantProfiles } = await client
    .from('merchant_profiles')
    .select('account_id, business_name, address, city, accounts(picture_url)')
    .in('account_id', merchantIds);

  const merchantMap = new Map(
    (merchantProfiles ?? []).map((m) => [
      m.account_id,
      {
        id: m.account_id,
        business_name: m.business_name,
        address: m.address,
        city: m.city,
        picture_url: Array.isArray(m.accounts)
          ? m.accounts[0]?.picture_url
          : ((m.accounts as { picture_url?: string | null })?.picture_url ??
            null),
      },
    ]),
  );

  return data
    .filter((r) => r.discount)
    .map((r) => {
      const merchant = merchantMap.get(r.merchant_id);
      return {
        id: r.id,
        status: r.status,
        redeemed_at: r.redeemed_at,
        card_id: r.card_id,
        discount: {
          id: r.discount!.id,
          title: r.discount!.title,
          category: r.discount!.category,
        },
        merchant: {
          id: r.merchant_id,
          business_name: merchant?.business_name ?? null,
          address: merchant?.address ?? null,
          city: merchant?.city ?? null,
          picture_url: merchant?.picture_url ?? null,
        },
      };
    });
}

interface DiscountWithMerchantProfile {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  merchant: {
    id: string;
    business_name: string | null;
    address: string | null;
    city: string | null;
    picture_url: string | null;
  } | null;
}

async function fetchDiscounts(
  client: SupabaseClient<Database>,
): Promise<DiscountWithMerchantProfile[]> {
  const { data } = await client
    .from('discounts')
    .select(
      `
      id,
      title,
      description,
      category,
      valid_from,
      valid_until,
      is_active,
      merchant_id
    `,
    )
    .order('created_at', { ascending: false });

  if (!data) {
    return [];
  }

  // Fetch merchant profiles for all unique merchant IDs
  const merchantIds = [
    ...new Set(data.map((d) => d.merchant_id).filter(Boolean)),
  ] as string[];
  const { data: merchantProfiles } = await client
    .from('merchant_profiles')
    .select('account_id, business_name, address, city, accounts(picture_url)')
    .in('account_id', merchantIds);

  const merchantMap = new Map(
    (merchantProfiles ?? []).map((m) => [
      m.account_id,
      {
        id: m.account_id,
        business_name: m.business_name,
        address: m.address,
        city: m.city,
        picture_url: Array.isArray(m.accounts)
          ? m.accounts[0]?.picture_url
          : ((m.accounts as { picture_url?: string | null })?.picture_url ??
            null),
      },
    ]),
  );

  return data.map((d) => {
    const merchant = d.merchant_id ? merchantMap.get(d.merchant_id) : null;
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      category: d.category,
      valid_from: d.valid_from,
      valid_until: d.valid_until,
      is_active: d.is_active,
      merchant: merchant
        ? {
            id: merchant.id,
            business_name: merchant.business_name,
            address: merchant.address,
            city: merchant.city,
            picture_url: merchant.picture_url,
          }
        : null,
    };
  });
}

function calculateStats(
  card: CardholderCard | null,
  redemptions: RedemptionWithDetails[],
): CardholderStats {
  const completedRedemptions = redemptions.filter(
    (r) => r.status === 'completed',
  );

  const discountsUsed = completedRedemptions.length;

  let daysRemaining = 0;
  if (card?.expires_at) {
    const expiresAt = new Date(card.expires_at);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  return {
    discountsUsed,
    daysRemaining,
  };
}

function categorizeDiscounts(
  allDiscounts: DiscountWithMerchantProfile[],
  redemptions: RedemptionWithDetails[],
): {
  active: ActiveDiscountWithUsage[];
  expired: DiscountWithMerchant[];
  redeemed: RedeemedDiscount[];
} {
  const now = new Date();

  // Build a map of discount_id -> usage count for completed redemptions
  const usageCountMap = new Map<string, number>();
  for (const redemption of redemptions) {
    if (redemption.status === 'completed') {
      const discountId = redemption.discount.id;
      usageCountMap.set(discountId, (usageCountMap.get(discountId) ?? 0) + 1);
    }
  }

  const active: ActiveDiscountWithUsage[] = [];
  const expired: DiscountWithMerchant[] = [];

  for (const discount of allDiscounts) {
    if (!discount.merchant) continue;

    const isExpired =
      discount.valid_until && new Date(discount.valid_until) < now;

    const discountWithMerchant: DiscountWithMerchant = {
      id: discount.id,
      title: discount.title,
      description: discount.description,
      category: discount.category,
      valid_until: discount.valid_until,
      merchant: {
        id: discount.merchant.id,
        business_name: discount.merchant.business_name ?? 'Unknown Merchant',
        address: discount.merchant.address,
        city: discount.merchant.city,
        picture_url: discount.merchant.picture_url,
      },
    };

    if (isExpired || !discount.is_active) {
      expired.push(discountWithMerchant);
    } else {
      active.push({
        ...discountWithMerchant,
        usageCount: usageCountMap.get(discount.id) ?? 0,
      });
    }
  }

  // Build redeemed list from redemptions
  const redeemed: RedeemedDiscount[] = redemptions
    .filter((r) => r.status === 'completed')
    .map((r) => ({
      id: r.id,
      title: r.discount.title,
      category: r.discount.category,
      redeemed_at: r.redeemed_at,
      merchant: {
        id: r.merchant.id,
        business_name: r.merchant.business_name ?? 'Unknown Merchant',
        address: r.merchant.address,
        city: r.merchant.city,
        picture_url: r.merchant.picture_url,
      },
    }));

  return { active, expired, redeemed };
}

function emptyDashboardData(): CardholderDashboardData {
  return {
    card: null,
    stats: {
      discountsUsed: 0,
      daysRemaining: 0,
    },
    discounts: {
      active: [],
      expired: [],
      redeemed: [],
    },
    walletStatus: {
      appleAddedAt: null,
      googleAddedAt: null,
    },
  };
}
