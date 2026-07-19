import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import type { Database } from '~/lib/database.types';
import { getCorrelationId } from '~/lib/server/action-context';

type CardStatus = Database['public']['Enums']['card_status'];

export interface DiscountPreview {
  id: string;
  title: string;
  merchant: {
    id: string;
    business_name: string;
    address: string | null;
    city: string | null;
    picture_url: string | null;
  };
}

type CardType = Database['public']['Enums']['card_type'];

export interface CardActivationData {
  found: boolean;
  card: {
    // Null for the digital buy page where no card row exists yet.
    id: string | null;
    display_code: string | null;
    status: CardStatus;
    price_cents: number;
    organization: {
      id: string;
      name: string;
      picture_url?: string | null;
      city?: string | null;
      state?: string | null;
    };
    // The org's district (ledger #19). When district.type === 'campus' the header
    // makes the district the headline and the org the secondary line.
    district?: {
      id: string;
      name: string;
      type: string | null;
      picture_url?: string | null;
      city?: string | null;
      state?: string | null;
      // Naming preset for this district; resolved to tier labels
      // ("Campus"/"Chapter") for the goal-bar label via ~/lib/naming.
      naming_preset?: string | null;
    } | null;
    card_type?: CardType;
    claim_token?: string;
    distributor_id?: string | null;
    distributor_name?: string | null;
    distributor_slug?: string;
    organization_slug?: string;
    buyer_email?: string | null;
  } | null;
  error?: string;
}

const CLAIM_TOKEN_REGEX = /^[A-Za-z0-9_-]{20,}$/;

/**
 * Parses a display code into its components.
 * Format: "ORG-BATCH-NUMBER" (e.g., "ACME-SPR25-1")
 */
function parseDisplayCode(displayCode: string): {
  orgPrefix: string;
  batchPrefix: string;
  cardNumber: number;
} | null {
  const parts = displayCode.split('-');

  if (parts.length !== 3) return null;

  const [orgPrefix, batchPrefix, numberStr] = parts;
  const cardNumber = parseInt(numberStr ?? '', 10);

  if (!orgPrefix || !batchPrefix || isNaN(cardNumber)) return null;

  return { orgPrefix, batchPrefix, cardNumber };
}

/**
 * Loads card data by display code OR by digital claim token.
 * Display codes match the parser (ORG-BATCH-NUMBER); anything else that looks
 * token-shaped is resolved through the SECURITY DEFINER RPC
 * `get_digital_card_for_activation` so anon clients can't enumerate live tokens.
 */
export const loadCardByCode = cache(
  async (codeOrToken: string): Promise<CardActivationData> => {
    if (!codeOrToken) {
      return { found: false, card: null, error: 'No card code provided' };
    }

    const client = getSupabaseServerClient();

    const parsed = parseDisplayCode(codeOrToken);

    if (!parsed) {
      if (CLAIM_TOKEN_REGEX.test(codeOrToken)) {
        return loadDigitalCardByClaimToken(client, codeOrToken);
      }
      return { found: false, card: null, error: 'Invalid card code format' };
    }

    // Find organization by card_prefix
    const { data: org, error: orgError } = await client
      .from('accounts')
      .select('id, name, card_prefix')
      .eq('card_prefix', parsed.orgPrefix)
      .single();

    if (orgError || !org) {
      return { found: false, card: null, error: 'Card not found' };
    }

    // Find batch by prefix
    const { data: batch, error: batchError } = await client
      .from('batches')
      .select('id')
      .eq('organization_id', org.id)
      .eq('prefix', parsed.batchPrefix)
      .single();

    if (batchError || !batch) {
      return { found: false, card: null, error: 'Card not found' };
    }

    // Find card by batch_id and card_number
    const { data: card, error } = await client
      .from('cards')
      .select(
        `
        id,
        card_number,
        status,
        price_cents,
        organization_id
      `,
      )
      .eq('batch_id', batch.id)
      .eq('card_number', parsed.cardNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { found: false, card: null, error: 'Card not found' };
      }
      throw error;
    }

    if (!card) {
      return { found: false, card: null, error: 'Card not found' };
    }

    // Get organization card price (may override default)
    const { data: orgProfile } = await client
      .from('organization_profiles')
      .select('card_price_cents')
      .eq('account_id', card.organization_id)
      .single();

    const priceCents = orgProfile?.card_price_cents ?? card.price_cents ?? 2500;

    return {
      found: true,
      card: {
        id: card.id,
        display_code: codeOrToken,
        status: card.status,
        price_cents: priceCents,
        organization: {
          id: org.id,
          name: org.name ?? 'Unknown Organization',
        },
        card_type: 'physical',
      },
    };
  },
);

async function loadDigitalCardByClaimToken(
  client: SupabaseClient<Database>,
  claimToken: string,
): Promise<CardActivationData> {
  const { data, error } = await client.rpc('get_digital_card_for_activation', {
    p_claim_token: claimToken,
  });

  if (error) {
    // Keep the user-facing "Card not found" shape, but don't lose a genuine
    // RPC fault — log it with the request reference for tracing.
    const [logger, reference] = await Promise.all([
      getLogger(),
      getCorrelationId(),
    ]);
    logger.warn(
      { name: 'loadDigitalCardByClaimToken', reference, error: error.message },
      'Digital card lookup RPC failed',
    );
    return { found: false, card: null, error: 'Card not found' };
  }

  const row = data?.[0];

  if (!row) {
    return { found: false, card: null, error: 'Card not found' };
  }

  const displayCode = formatCardDisplayCode({
    card_type: 'digital',
    card_number: null,
    digital_card_number: row.digital_card_number ?? null,
    organization_prefix: null,
    batch_prefix: null,
  });

  return {
    found: true,
    card: {
      id: row.id,
      display_code: displayCode,
      status: row.status,
      price_cents: row.price_cents ?? 0,
      organization: {
        id: row.organization_id,
        name: row.organization_name ?? 'Unknown Organization',
        picture_url: row.organization_picture_url,
      },
      card_type: 'digital',
      claim_token: claimToken,
      buyer_email: row.buyer_email,
    },
  };
}

/**
 * Fetches discount previews for an organization using admin client.
 * Only shows discounts from merchants explicitly paired with the organization
 * via organization_merchant_partnerships (admin-paired).
 */
export async function fetchDiscountsForOrg(
  adminClient: SupabaseClient<Database>,
  organizationId: string,
): Promise<DiscountPreview[]> {
  const now = new Date().toISOString();

  const [logger, reference] = await Promise.all([
    getLogger(),
    getCorrelationId(),
  ]);
  const logCtx = {
    name: 'fetchDiscountsForOrg',
    reference,
    organizationId,
  };

  // Get partnership merchant IDs
  const { data: partnerships, error: partnershipsError } = await adminClient
    .from('organization_merchant_partnerships')
    .select('merchant_id')
    .eq('organization_id', organizationId);

  if (partnershipsError) {
    // Don't swallow: an empty preview here may be a real query fault, not just
    // "no partners". Log it (with the request reference) and degrade to [].
    logger.warn(
      { ...logCtx, error: partnershipsError.message },
      'Failed to load merchant partnerships for discount preview',
    );
    return [];
  }

  const partnerMerchantIds = (partnerships ?? []).map((p) => p.merchant_id);

  if (partnerMerchantIds.length === 0) {
    return [];
  }

  // Fetch active discounts from partnered merchants only
  const { data: discounts, error: discountsError } = await adminClient
    .from('discounts')
    .select('id, title, merchant_id')
    .eq('is_active', true)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .in('merchant_id', partnerMerchantIds);

  if (discountsError) {
    logger.warn(
      { ...logCtx, error: discountsError.message },
      'Failed to load discounts for discount preview',
    );
    return [];
  }

  if (!discounts || discounts.length === 0) {
    return [];
  }

  // 4. Fetch merchant profiles for all discount merchants
  const merchantIds = [
    ...new Set(discounts.map((d) => d.merchant_id).filter(Boolean)),
  ] as string[];

  const { data: merchantProfiles, error: merchantProfilesError } =
    await adminClient
      .from('merchant_profiles')
      .select('account_id, business_name, address, city, accounts(picture_url)')
      .in('account_id', merchantIds);

  if (merchantProfilesError) {
    logger.warn(
      { ...logCtx, error: merchantProfilesError.message },
      'Failed to load merchant profiles for discount preview',
    );
    return [];
  }

  const merchantMap = new Map(
    (merchantProfiles ?? []).map((m) => [
      m.account_id,
      {
        id: m.account_id,
        business_name: m.business_name ?? 'Unknown Merchant',
        address: m.address,
        city: m.city,
        picture_url: Array.isArray(m.accounts)
          ? (m.accounts[0]?.picture_url ?? null)
          : ((m.accounts as { picture_url?: string | null })?.picture_url ??
            null),
      },
    ]),
  );

  return discounts
    .map((d) => {
      const merchant = merchantMap.get(d.merchant_id);

      if (!merchant) return null;

      return {
        id: d.id,
        title: d.title,
        merchant,
      };
    })
    .filter((d): d is DiscountPreview => d !== null);
}

export const loadDiscountsForOrganization = cache(
  async (organizationId: string): Promise<DiscountPreview[]> => {
    const adminClient = getSupabaseServerAdminClient();

    return fetchDiscountsForOrg(adminClient, organizationId);
  },
);
