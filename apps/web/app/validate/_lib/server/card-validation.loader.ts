import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import type { Database } from '~/lib/database.types';

type CardStatus = Database['public']['Enums']['card_status'];

export interface CardValidationData {
  valid: boolean;
  card: {
    id: string;
    display_code: string;
    status: CardStatus;
    cardholder_name: string | null;
    expires_at: string | null;
    organization: {
      id: string;
      name: string;
    };
  } | null;
  error?: string;
}

export interface MerchantDiscountData {
  id: string;
  title: string;
  description: string | null;
  terms: string | null;
}

export interface MerchantAccountData {
  id: string;
  name: string;
  slug: string;
}

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
 * Loads card data for merchant validation.
 * Card must be activated and not expired to be valid.
 *
 * Display code format: "ORG-BATCH-NUMBER" (e.g., "ACME-SPR25-1")
 */
export const loadCardForValidation = cache(
  async (displayCode: string): Promise<CardValidationData> => {
    if (!displayCode) {
      return { valid: false, card: null, error: 'No card code provided' };
    }

    const client = getSupabaseServerClient();

    // Parse the display code
    const parsed = parseDisplayCode(displayCode);
    if (!parsed) {
      return { valid: false, card: null, error: 'Invalid card code format' };
    }

    // Find organization by card_prefix
    const { data: org, error: orgError } = await client
      .from('accounts')
      .select('id, name, card_prefix')
      .eq('card_prefix', parsed.orgPrefix)
      .single();

    if (orgError || !org) {
      return { valid: false, card: null, error: 'Card not found' };
    }

    // Find batch by prefix
    const { data: batch, error: batchError } = await client
      .from('batches')
      .select('id')
      .eq('organization_id', org.id)
      .eq('prefix', parsed.batchPrefix)
      .single();

    if (batchError || !batch) {
      return { valid: false, card: null, error: 'Card not found' };
    }

    // Find card by batch_id and card_number
    const { data: card, error } = await client
      .from('cards')
      .select(
        `
        id,
        card_number,
        status,
        expires_at,
        cardholder:accounts!cards_cardholder_id_fkey (
          id,
          name
        )
      `,
      )
      .eq('batch_id', batch.id)
      .eq('card_number', parsed.cardNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { valid: false, card: null, error: 'Card not found' };
      }
      throw error;
    }

    if (!card) {
      return { valid: false, card: null, error: 'Card not found' };
    }

    // Check card status
    if (card.status !== 'activated') {
      return {
        valid: false,
        card: null,
        error:
          card.status === 'pending'
            ? 'Card has not been activated yet'
            : card.status === 'expired'
              ? 'Card has expired'
              : 'Card has been cancelled',
      };
    }

    // Check expiration
    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      return {
        valid: false,
        card: null,
        error: 'Card has expired',
      };
    }

    const cardholder = Array.isArray(card.cardholder)
      ? card.cardholder[0]
      : card.cardholder;

    return {
      valid: true,
      card: {
        id: card.id,
        display_code: displayCode,
        status: card.status,
        cardholder_name: cardholder?.name ?? null,
        expires_at: card.expires_at,
        organization: {
          id: org.id,
          name: org.name ?? 'Unknown',
        },
      },
    };
  },
);

/**
 * Loads card data for merchant validation by UUID.
 * Used by the QR-scan path (`/validate?card_id=<uuid>`) and works for both
 * physical and digital cards. Manual code entry stays on `loadCardForValidation`.
 */
export const loadCardForValidationById = cache(
  async (cardId: string): Promise<CardValidationData> => {
    if (!cardId) {
      return { valid: false, card: null, error: 'No card id provided' };
    }

    const client = getSupabaseServerClient();

    const { data: card, error } = await client
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
          card_prefix
        ),
        batch:batches!cards_batch_id_fkey (
          prefix
        ),
        cardholder:accounts!cards_cardholder_id_fkey (
          id,
          name
        )
      `,
      )
      .eq('id', cardId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { valid: false, card: null, error: 'Card not found' };
      }
      throw error;
    }

    if (!card) {
      return { valid: false, card: null, error: 'Card not found' };
    }

    const organization = Array.isArray(card.organization)
      ? card.organization[0]
      : card.organization;

    if (!organization) {
      return { valid: false, card: null, error: 'Card not found' };
    }

    if (card.status !== 'activated') {
      return {
        valid: false,
        card: null,
        error:
          card.status === 'pending'
            ? 'Card has not been activated yet'
            : card.status === 'expired'
              ? 'Card has expired'
              : 'Card has been cancelled',
      };
    }

    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      return {
        valid: false,
        card: null,
        error: 'Card has expired',
      };
    }

    const cardholder = Array.isArray(card.cardholder)
      ? card.cardholder[0]
      : card.cardholder;
    const batch = Array.isArray(card.batch) ? card.batch[0] : card.batch;

    const displayCode = formatCardDisplayCode({
      card_type: card.card_type,
      card_number: card.card_number,
      digital_card_number: card.digital_card_number,
      organization_prefix: organization.card_prefix ?? null,
      batch_prefix: batch?.prefix ?? null,
    });

    return {
      valid: true,
      card: {
        id: card.id,
        display_code: displayCode,
        status: card.status,
        cardholder_name: cardholder?.name ?? null,
        expires_at: card.expires_at,
        organization: {
          id: organization.id,
          name: organization.name ?? 'Unknown',
        },
      },
    };
  },
);

/**
 * Loads the merchant accounts the current user has access to.
 */
export const loadUserMerchantAccounts = cache(
  async (): Promise<MerchantAccountData[]> => {
    const client = getSupabaseServerClient();

    // Get accounts where user has merchant role
    // and the account has a merchant profile
    const { data, error } = await client
      .from('accounts_memberships')
      .select(
        `
        account:accounts!inner (
          id,
          name,
          slug,
          merchant_profile:merchant_profiles!inner (
            id
          )
        )
      `,
      )
      .eq('user_id', (await client.auth.getUser()).data.user?.id ?? '');

    if (error) {
      console.error('Error loading merchant accounts:', error);
      return [];
    }

    return (
      data
        ?.map((item) => {
          const account = Array.isArray(item.account)
            ? item.account[0]
            : item.account;
          return account
            ? { id: account.id, name: account.name, slug: account.slug }
            : null;
        })
        .filter((a): a is MerchantAccountData => a !== null) ?? []
    );
  },
);

/**
 * Loads active discounts for a specific merchant.
 */
export const loadMerchantDiscounts = cache(
  async (merchantId: string): Promise<MerchantDiscountData[]> => {
    const client = getSupabaseServerClient();

    const { data, error } = await client
      .from('discounts')
      .select(
        `
        id,
        title,
        description,
        terms
      `,
      )
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .lte('valid_from', new Date().toISOString())
      .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`);

    if (error) {
      console.error('Error loading merchant discounts:', error);
      return [];
    }

    return (data ?? []) as MerchantDiscountData[];
  },
);
