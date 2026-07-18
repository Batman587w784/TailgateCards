import 'server-only';

import Stripe from 'stripe';

/**
 * Lazy Stripe client initialization.
 * Only creates the client when actually needed (not at import time).
 * This allows the MVP flow to work without Stripe credentials.
 */
function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not configured. Stripe payments are disabled.',
    );
  }

  return new Stripe(secretKey, {
    apiVersion: '2025-10-29.clover',
  });
}

interface CardChargeBreakdown {
  /** The clean card price the organization nets (e.g. 2500 = $25.00). */
  cardCents: number;
  /** Transaction fee added so the org isn't out-of-pocket for Stripe's cut. */
  feeCents: number;
  /** Sales tax, applied to the card + fee subtotal. */
  taxCents: number;
  /** Card price + transaction fee (the pre-tax line shown at checkout). */
  subtotalCents: number;
  /** Grand total charged to the buyer (subtotal + tax). */
  totalCents: number;
}

/**
 * Computes the full charge breakdown for a card purchase.
 *
 * Tax is applied to the card price *plus* the transaction fee (the subtotal),
 * matching the pricing the platform billed before the inline-checkout rewrite.
 * The transaction fee is "grossed up" so that, after Stripe deducts its
 * `percent × total + fixed` processing fee from the amount collected, the
 * organization still nets the card price plus tax:
 *
 *   fee = (rate × (card + tax_on_card) + fixed) / (1 − rate)
 *
 * Both the percentage and the fixed component mirror Stripe's standard pricing
 * (2.9% + $0.30) and are configured via env (`CARD_TRANSACTION_FEE_PERCENT`,
 * `CARD_TRANSACTION_FEE_FIXED_CENTS`), alongside `CARD_TAX_RATE_PERCENT`. When
 * unset they default to 0 and no fee is added.
 */
function calculateCardCharge(cardCents: number): CardChargeBreakdown {
  // Floor at 0 so a misconfigured negative value can never charge the buyer
  // below the card's face value.
  const taxRatePercent = Math.max(
    0,
    Number(process.env.CARD_TAX_RATE_PERCENT) || 0,
  );
  const feePercent = Math.max(
    0,
    Number(process.env.CARD_TRANSACTION_FEE_PERCENT) || 0,
  );
  const feeFixedCents = Math.max(
    0,
    Number(process.env.CARD_TRANSACTION_FEE_FIXED_CENTS) || 0,
  );

  // Tax on the card price alone, used only to size the fee gross-up.
  const baseTaxCents = Math.round(cardCents * (taxRatePercent / 100));

  // Guard against a misconfigured rate ≥ 100% (would divide by zero / flip
  // sign); fall back to the fixed component only.
  const feeRate = feePercent / 100;
  const feeCents =
    feeRate < 1
      ? Math.round(
          (feeRate * (cardCents + baseTaxCents) + feeFixedCents) /
            (1 - feeRate),
        )
      : feeFixedCents;

  const subtotalCents = cardCents + feeCents;
  // Final tax is charged on the full subtotal (card + fee).
  const taxCents = Math.round(subtotalCents * (taxRatePercent / 100));
  const totalCents = subtotalCents + taxCents;

  return { cardCents, feeCents, taxCents, subtotalCents, totalCents };
}

interface CreateDigitalCardPaymentIntentParams {
  distributorAccountId: string | null;
  organizationId: string;
  organizationName: string;
  /** Unit price of a single card. */
  priceCents: number;
  /** Number of cards in this checkout (default 1). */
  quantity?: number;
}

/**
 * Creates a Stripe PaymentIntent for an inline digital-card purchase.
 * Mirrors `createCardPaymentIntent` but for the digital flow — the card row
 * is created by the webhook (or by `confirmDigitalPaymentAndActivate`, which
 * idempotently calls the same RPC) once payment succeeds.
 */
export async function createDigitalCardPaymentIntent(
  params: CreateDigitalCardPaymentIntentParams,
): Promise<PaymentIntentResult> {
  const stripe = getStripeClient();

  const { priceCents } = params;
  // Quantity multiplies the card price; the fixed processing fee is charged once
  // per PaymentIntent (one Stripe transaction), which calculateCardCharge does
  // by taking the aggregate card amount.
  const quantity = Math.max(1, Math.floor(params.quantity ?? 1));
  const cardCents = priceCents * quantity;
  const { feeCents, taxCents, subtotalCents, totalCents } =
    calculateCardCharge(cardCents);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'usd',
    description:
      quantity > 1
        ? `Tailgate Digital Cards (x${quantity}) - ${params.organizationName}`
        : `Tailgate Digital Card - ${params.organizationName}`,
    metadata: {
      kind: 'digital_card',
      ...(params.distributorAccountId
        ? { distributor_id: params.distributorAccountId }
        : {}),
      organization_id: params.organizationId,
      quantity: quantity.toString(),
      unit_price_cents: priceCents.toString(),
      card_cents: cardCents.toString(),
      fee_cents: feeCents.toString(),
      subtotal_cents: subtotalCents.toString(),
      tax_cents: taxCents.toString(),
    },
    automatic_payment_methods: {
      enabled: true,
    },
  });

  if (!paymentIntent.client_secret) {
    throw new Error('Failed to create digital card payment intent');
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    subtotalCents,
    feeCents,
    taxCents,
    totalCents,
  };
}

interface CreatePaymentIntentParams {
  cardId: string;
  cardCode: string;
  organizationId: string;
  organizationName: string;
  priceCents: number;
}

interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  subtotalCents: number;
  feeCents: number;
  taxCents: number;
  totalCents: number;
}

/**
 * Creates a Stripe PaymentIntent for embedded card payment.
 * Uses the org's card_price_cents (passed in by the caller) and adds tax.
 * Used with Stripe Elements for inline payment form.
 */
export async function createCardPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<PaymentIntentResult> {
  const stripe = getStripeClient();

  const { priceCents } = params;

  const { feeCents, taxCents, subtotalCents, totalCents } =
    calculateCardCharge(priceCents);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'usd',
    description: `Tailgate Card - ${params.organizationName}`,
    metadata: {
      card_id: params.cardId,
      card_code: params.cardCode,
      organization_id: params.organizationId,
      type: 'card_purchase',
      card_cents: priceCents.toString(),
      fee_cents: feeCents.toString(),
      subtotal_cents: subtotalCents.toString(),
      tax_cents: taxCents.toString(),
    },
    // Enable automatic payment methods (Apple Pay, PayPal, Venmo, etc.)
    automatic_payment_methods: {
      enabled: true,
    },
  });

  if (!paymentIntent.client_secret) {
    throw new Error('Failed to create payment intent');
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    subtotalCents,
    feeCents,
    taxCents,
    totalCents,
  };
}

/**
 * Retrieves a PaymentIntent by ID.
 * Used to verify payment status.
 */
export async function getPaymentIntent(paymentIntentId: string) {
  const stripe = getStripeClient();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Constructs and verifies a Stripe webhook event.
 */
export async function constructWebhookEvent(
  payload: string,
  signature: string,
): Promise<Stripe.Event> {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
