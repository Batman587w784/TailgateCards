import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { DiscountPreview } from './card-activation.loader';
import { fetchDiscountsForOrg } from './card-activation.loader';

export interface ResolvedDiscount {
  title: string;
  merchantName: string;
  logoUrl: string | null;
}

export interface ResolvedCard {
  cardId: string;
  organizationId: string;
  cardCode: string;
  cardType: 'physical' | 'digital';
  organizationName: string;
  organizationLogoUrl: string | null;
  batchName: string | null;
  expiresAt: string | null;
  discountCount: number;
  /**
   * The offers this card can access, listed on the wallet pass (Apple back
   * fields / Google Pass Details). Org-scoped, so identical for every card in
   * the org. Sorted by merchant name for a stable pass layout.
   */
  discounts: ResolvedDiscount[];
}

function toResolvedDiscounts(previews: DiscountPreview[]): ResolvedDiscount[] {
  return previews
    .map((preview) => ({
      title: preview.title,
      merchantName: preview.merchant.business_name || 'Unknown Merchant',
      logoUrl: preview.merchant.picture_url,
    }))
    .sort(
      (a, b) =>
        a.merchantName.localeCompare(b.merchantName) ||
        a.title.localeCompare(b.title),
    );
}

function parsePhysicalCode(displayCode: string): {
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

function parseDigitalCode(displayCode: string): number | null {
  // Digital format: D-NNNNNN (zero-padded)
  const match = displayCode.match(/^D-(\d+)$/);
  if (!match || !match[1]) return null;
  const n = parseInt(match[1], 10);
  return isNaN(n) ? null : n;
}

/**
 * Resolves a card code into the data used to enrich its wallet pass.
 *
 * The wallet pass is purely cosmetic — entitlement is granted by the DB row,
 * validated at the merchant point of sale, not by the pass. So a failed
 * enrichment lookup returns null and the caller falls back to a minimal pass
 * rather than blocking save.
 *
 * `discountCount` and `discounts` reuse `fetchDiscountsForOrg` — the same
 * partnership-scoped, active-and-in-window query that drives the activation-flow
 * discount preview — so the wallet count and offer list always match what the
 * cardholder sees in-app.
 */
export async function resolveCard(
  cardCode: string,
): Promise<ResolvedCard | null> {
  const admin = getSupabaseServerAdminClient();
  const upper = cardCode.toUpperCase();

  const physical = parsePhysicalCode(upper);
  if (physical) {
    const { data: org } = await admin
      .from('accounts')
      .select('id, name, picture_url')
      .eq('card_prefix', physical.orgPrefix)
      .single();
    if (!org) return null;

    const { data: batch } = await admin
      .from('batches')
      .select('id, name')
      .eq('organization_id', org.id)
      .eq('prefix', physical.batchPrefix)
      .single();
    if (!batch) return null;

    const { data: card } = await admin
      .from('cards')
      .select('id, expires_at')
      .eq('batch_id', batch.id)
      .eq('card_number', physical.cardNumber)
      .single();
    if (!card) return null;

    const discounts = toResolvedDiscounts(
      await fetchDiscountsForOrg(admin, org.id),
    );

    return {
      cardId: card.id,
      organizationId: org.id,
      cardCode: upper,
      cardType: 'physical',
      organizationName: org.name ?? 'Tailgate',
      organizationLogoUrl: org.picture_url ?? null,
      batchName: batch.name,
      expiresAt: card.expires_at,
      discountCount: discounts.length,
      discounts,
    };
  }

  const digitalNumber = parseDigitalCode(upper);
  if (digitalNumber !== null) {
    // digital_card_number is unique per org but not globally — the cardCode
    // alone can be ambiguous across orgs. We pick the first match; in the
    // worst case the wallet pass shows the wrong org name (cosmetic only).
    const { data: card } = await admin
      .from('cards')
      .select('id, expires_at, organization_id')
      .eq('card_type', 'digital')
      .eq('digital_card_number', digitalNumber)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (!card) return null;

    const { data: org } = await admin
      .from('accounts')
      .select('id, name, picture_url')
      .eq('id', card.organization_id)
      .single();

    const discounts = toResolvedDiscounts(
      await fetchDiscountsForOrg(admin, card.organization_id),
    );

    return {
      cardId: card.id,
      organizationId: card.organization_id,
      cardCode: upper,
      cardType: 'digital',
      organizationName: org?.name ?? 'Tailgate',
      organizationLogoUrl: org?.picture_url ?? null,
      batchName: null,
      expiresAt: card.expires_at,
      discountCount: discounts.length,
      discounts,
    };
  }

  return null;
}
