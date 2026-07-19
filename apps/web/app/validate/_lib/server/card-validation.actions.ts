'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import { fail, withActionContext } from '~/lib/server/action-context';

const RecordRedemptionSchema = z.object({
  cardId: z.string().uuid(),
  discountId: z.string().uuid(),
  merchantId: z.string().uuid(),
});

const ValidateCardSchema = z.object({
  displayCode: z.string().min(1),
  merchantId: z.string().uuid(),
});

const CardIdSchema = z.string().uuid();

function extractCardId(scannedValue: string) {
  const value = scannedValue.trim();

  if (CardIdSchema.safeParse(value).success) {
    return value;
  }

  try {
    const url = new URL(value, 'https://tailgate.local');
    const cardId = url.searchParams.get('card_id');

    return cardId && CardIdSchema.safeParse(cardId).success ? cardId : null;
  } catch {
    return null;
  }
}

/**
 * A card is redeemable only when a cardholder has activated it and it has not
 * passed its 365-day expiry. Single source of truth shared by validateCard
 * (the on-screen status) and recordRedemption (the hard write gate) so the two
 * never disagree.
 *
 * Expiry is a pure `expires_at` timestamp comparison — nothing writes
 * `status = 'expired'`, so the status flag alone would never expire a card.
 */
function isCardRedeemable(status: string, expiresAt: string | null): boolean {
  if (status !== 'activated') return false;
  if (expiresAt !== null && new Date(expiresAt) < new Date()) return false;
  return true;
}

/**
 * Records a discount redemption for a card.
 * Called when merchant staff applies a discount to a cardholder.
 */
export const recordRedemption = enhanceAction(
  async (data) =>
    withActionContext('recordRedemption', async (ctx) => {
      const { cardId, discountId, merchantId } = data;

      const client = getSupabaseServerClient();
      const {
        data: { user },
      } = await client.auth.getUser();

      if (!user) {
        return fail(ctx, 'NOT_AUTHENTICATED');
      }

      const { data: membership, error: membershipError } = await client
        .from('accounts_memberships')
        .select('account_id')
        .eq('user_id', user.id)
        .eq('account_id', merchantId)
        .eq('account_role', 'merchant')
        .maybeSingle();

      if (membershipError || !membership) {
        return fail(ctx, 'MERCHANT_ACCESS_DENIED', {
          detail: { merchantId, error: membershipError?.message },
          level: 'error',
        });
      }

      // R0 — hard expiry/status gate on the mutation. The validation *screen*
      // already surfaces "Card has expired", but the redemption *write* did not
      // check, so an expired card could still be redeemed by a direct call.
      // Merchants can read any card via the cards_merchant_validate_read policy.
      const { data: card, error: cardError } = await client
        .from('cards')
        .select('status, expires_at')
        .eq('id', cardId)
        .maybeSingle();

      if (cardError || !card) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { cardId, error: cardError?.message },
        });
      }

      if (!isCardRedeemable(card.status, card.expires_at)) {
        return fail(ctx, 'CARD_NOT_REDEEMABLE', {
          detail: { cardId, status: card.status, expiresAt: card.expires_at },
        });
      }

      // Verify discount belongs to the merchant and is active
      const { data: discount, error: discountError } = await client
        .from('discounts')
        .select('merchant_id, is_active')
        .eq('id', discountId)
        .single();

      if (discountError || !discount) {
        return fail(ctx, 'DISCOUNT_NOT_FOUND', {
          detail: { discountId, error: discountError?.message },
        });
      }

      if (discount.merchant_id !== merchantId) {
        return fail(ctx, 'DISCOUNT_MERCHANT_MISMATCH', {
          detail: { discountId, merchantId, ownerId: discount.merchant_id },
          level: 'error',
        });
      }

      if (!discount.is_active) {
        return fail(ctx, 'DISCOUNT_INACTIVE', { detail: { discountId } });
      }

      // Record the redemption
      const { error: insertError } = await client.from('redemptions').insert({
        card_id: cardId,
        discount_id: discountId,
        merchant_id: merchantId,
        validated_by: user.id,
        status: 'completed',
      });

      if (insertError) {
        // Surfaces the real cause (e.g. an RLS denial) in the log keyed by the
        // same reference the user sees, instead of a bare "failed" string.
        return fail(ctx, 'REDEMPTION_FAILED', {
          detail: {
            cardId,
            discountId,
            merchantId,
            pgCode: insertError.code,
            error: insertError.message,
          },
          level: 'error',
        });
      }

      ctx.logger.info(
        { name: ctx.name, reference: ctx.reference, cardId, discountId },
        'Redemption recorded',
      );

      return { success: true as const };
    }),
  {
    schema: RecordRedemptionSchema,
  },
);

/**
 * Validates a card and returns card + discount data for the merchant.
 * Used by the dashboard scan flow to fetch real data.
 */
export const validateCard = enhanceAction(
  async (data) =>
    withActionContext('validateCard', async (ctx) => {
      const { displayCode, merchantId } = data;
      const client = getSupabaseServerClient();
      const {
        data: { user },
      } = await client.auth.getUser();

      if (!user) {
        return fail(ctx, 'NOT_AUTHENTICATED');
      }

      const { data: membership, error: membershipError } = await client
        .from('accounts_memberships')
        .select('account_id')
        .eq('user_id', user.id)
        .eq('account_id', merchantId)
        .eq('account_role', 'merchant')
        .maybeSingle();

      if (membershipError || !membership) {
        return fail(ctx, 'MERCHANT_ACCESS_DENIED', {
          detail: { merchantId, error: membershipError?.message },
          level: 'error',
        });
      }

      const scannedCardId = extractCardId(displayCode);
      let card: {
        id: string;
        displayCode: string;
        status: string;
        expiresAt: string | null;
      } | null = null;

      if (scannedCardId) {
        const { data: cardById, error: cardByIdError } = await client
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
              card_prefix
            ),
            batch:batches!cards_batch_id_fkey (
              prefix
            )
          `,
          )
          .eq('id', scannedCardId)
          .single();

        if (cardByIdError || !cardById) {
          return fail(ctx, 'CARD_NOT_FOUND', {
            detail: {
              cardId: scannedCardId,
              stage: 'card_id',
              error: cardByIdError?.message,
            },
          });
        }

        const organization = Array.isArray(cardById.organization)
          ? cardById.organization[0]
          : cardById.organization;
        const batch = Array.isArray(cardById.batch)
          ? cardById.batch[0]
          : cardById.batch;

        card = {
          id: cardById.id,
          displayCode: formatCardDisplayCode({
            card_type: cardById.card_type,
            card_number: cardById.card_number,
            digital_card_number: cardById.digital_card_number,
            organization_prefix: organization?.card_prefix ?? null,
            batch_prefix: batch?.prefix ?? null,
          }),
          status: cardById.status,
          expiresAt: cardById.expires_at,
        };
      } else {
        // Display-code fallback for manual entry and older physical-card scans.
        const parts = displayCode.split('-');
        if (parts.length !== 3) {
          return fail(ctx, 'INVALID_CODE_FORMAT', { detail: { displayCode } });
        }

        const [orgPrefix, batchPrefix, numberStr] = parts;
        const cardNumber = parseInt(numberStr ?? '', 10);

        if (!orgPrefix || !batchPrefix || isNaN(cardNumber)) {
          return fail(ctx, 'INVALID_CODE_FORMAT', { detail: { displayCode } });
        }

        const { data: org, error: orgError } = await client
          .from('accounts')
          .select('id, name, card_prefix')
          .eq('card_prefix', orgPrefix)
          .single();

        if (orgError || !org) {
          return fail(ctx, 'CARD_NOT_FOUND', {
            detail: { displayCode, stage: 'org', error: orgError?.message },
          });
        }

        const { data: batch, error: batchError } = await client
          .from('batches')
          .select('id')
          .eq('organization_id', org.id)
          .eq('prefix', batchPrefix)
          .single();

        if (batchError || !batch) {
          return fail(ctx, 'CARD_NOT_FOUND', {
            detail: { displayCode, stage: 'batch', error: batchError?.message },
          });
        }

        const { data: cardByCode, error: cardError } = await client
          .from('cards')
          .select('id, card_number, status, expires_at')
          .eq('batch_id', batch.id)
          .eq('card_number', cardNumber)
          .single();

        if (cardError || !cardByCode) {
          return fail(ctx, 'CARD_NOT_FOUND', {
            detail: { displayCode, stage: 'card', error: cardError?.message },
          });
        }

        card = {
          id: cardByCode.id,
          displayCode,
          status: cardByCode.status,
          expiresAt: cardByCode.expires_at,
        };
      }

      // Card status + expiration — same rule as the redemption write gate.
      const nowIso = new Date().toISOString();
      const isActive = isCardRedeemable(card.status, card.expiresAt);

      // Get merchant's active discount
      const { data: discount } = await client
        .from('discounts')
        .select('id, title')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .lte('valid_from', nowIso)
        .or(`valid_until.is.null,valid_until.gt.${nowIso}`)
        .maybeSingle();

      // Format expiry date
      const validityDate = card.expiresAt
        ? new Date(card.expiresAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : null;

      return {
        success: true as const,
        data: {
          cardId: card.id,
          cardCode: card.displayCode,
          status: isActive ? ('active' as const) : ('expired' as const),
          validityDate,
          discount: discount
            ? { id: discount.id, title: discount.title }
            : null,
        },
      };
    }),
  {
    schema: ValidateCardSchema,
  },
);
