import type Stripe from 'stripe';

import { getServerMonitoringService } from '@kit/monitoring/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { constructWebhookEvent } from '~/activate/_lib/server/stripe-card-checkout.service';
import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import { sendDigitalCardClaimEmail } from '~/lib/server/digital-card-claim-email.service';

/**
 * Handle Stripe webhooks for card payments (physical + digital).
 */
export const POST = enhanceRouteHandler(
  async ({ request }) => {
    const logger = await getLogger();
    const ctx = { name: 'cards.webhook' };

    logger.info(ctx, 'Received card payment webhook');

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      logger.error(ctx, 'Missing stripe-signature header');
      return new Response('Missing signature', { status: 400 });
    }

    const body = await request.text();

    let event: Stripe.Event;
    try {
      event = await constructWebhookEvent(body, signature);
    } catch (error) {
      logger.error({ ...ctx, error }, 'Failed to construct webhook event');
      return new Response('Invalid signature', { status: 400 });
    }

    logger.info({ ...ctx, eventType: event.type }, 'Processing webhook event');

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          if (paymentIntent.metadata.kind === 'digital_card') {
            await handleDigitalCardPayment(paymentIntent, logger);
          } else {
            await handlePaymentSuccess(paymentIntent, logger);
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          logger.warn(
            { ...ctx, paymentIntentId: paymentIntent.id },
            'Payment failed',
          );
          break;
        }

        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          await handleChargeRefunded(charge, logger);
          break;
        }

        default:
          logger.info(
            { ...ctx, eventType: event.type },
            'Unhandled event type',
          );
      }
    } catch (error) {
      // An unexpected fault while processing a verified event. Never swallow:
      // log it, report to Sentry with event context, and return 500 so Stripe
      // retries the delivery.
      logger.error(
        { ...ctx, eventType: event.type, eventId: event.id, error },
        'Unhandled error processing webhook event',
      );

      const monitoring = await getServerMonitoringService();
      await monitoring.ready();
      monitoring.captureException(error as Error, {
        action: ctx.name,
        eventType: event.type,
        eventId: event.id,
      });

      return new Response('Webhook handler error', { status: 500 });
    }

    return new Response('OK', { status: 200 });
  },
  {
    auth: false,
  },
);

async function handlePaymentSuccess(
  paymentIntent: Stripe.PaymentIntent,
  logger: Awaited<ReturnType<typeof getLogger>>,
) {
  const ctx = {
    name: 'handlePaymentSuccess',
    paymentIntentId: paymentIntent.id,
  };

  // Check if this is a card purchase
  if (paymentIntent.metadata.type !== 'card_purchase') {
    logger.info(ctx, 'Not a card purchase, skipping');
    return;
  }

  const cardId = paymentIntent.metadata.card_id;
  const cardCode = paymentIntent.metadata.card_code;

  if (!cardId) {
    logger.error(ctx, 'Missing card_id in metadata');
    return;
  }

  logger.info({ ...ctx, cardId, cardCode }, 'Processing card payment success');

  const adminClient = getSupabaseServerAdminClient();

  // Check if card is still pending (not already activated by client)
  const { data: card, error: cardError } = await adminClient
    .from('cards')
    .select('id, status')
    .eq('id', cardId)
    .single();

  if (cardError || !card) {
    logger.error({ ...ctx, error: cardError }, 'Card not found');
    return;
  }

  // If card is already activated, skip (client already handled it)
  if (card.status === 'activated' || card.status === 'paid') {
    logger.info(
      { ...ctx, status: card.status },
      'Card already processed, skipping',
    );
    return;
  }

  // Update card to 'paid' status
  const { error: updateError } = await adminClient
    .from('cards')
    .update({
      status: 'paid',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_customer_email:
        typeof paymentIntent.customer === 'string'
          ? null
          : paymentIntent.receipt_email,
    })
    .eq('id', cardId)
    .eq('status', 'pending');

  if (updateError) {
    logger.error(
      { ...ctx, error: updateError },
      'Failed to update card status',
    );
    return;
  }

  logger.info({ ...ctx, cardId }, 'Card marked as paid via webhook');
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseIntOrNull(value: string | undefined): number | null {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function handleDigitalCardPayment(
  paymentIntent: Stripe.PaymentIntent,
  logger: Awaited<ReturnType<typeof getLogger>>,
) {
  const ctx = {
    name: 'handleDigitalCardPayment',
    paymentIntentId: paymentIntent.id,
  };

  const distributorId = paymentIntent.metadata.distributor_id ?? null;
  const organizationId = paymentIntent.metadata.organization_id;

  if (!organizationId) {
    logger.error(ctx, 'Missing organization_id in metadata');
    return;
  }

  const buyerEmail = paymentIntent.receipt_email;
  // Buyer phone (E.164) is attached to the PaymentIntent metadata at confirm
  // time by the purchase form (P1-5), so it survives to this webhook.
  const buyerPhone = paymentIntent.metadata.buyer_phone ?? null;

  // Quantity + unit price are set on the PI at creation time (P1-4b). Fall back
  // to a single card priced at the full charge if metadata is somehow absent.
  const quantity = parsePositiveInt(paymentIntent.metadata.quantity, 1);
  const unitPriceCents = parsePositiveInt(
    paymentIntent.metadata.unit_price_cents,
    paymentIntent.amount,
  );

  await createDigitalCardOrderAndEmail({
    paymentIntentId: paymentIntent.id,
    distributorId,
    organizationId,
    buyerEmail,
    buyerPhone,
    quantity,
    unitPriceCents,
    subtotalCents: parseIntOrNull(paymentIntent.metadata.subtotal_cents),
    feeCents: parseIntOrNull(paymentIntent.metadata.fee_cents),
    taxCents: parseIntOrNull(paymentIntent.metadata.tax_cents),
    totalCents: paymentIntent.amount,
    logger,
    ctx,
  });
}

async function createDigitalCardOrderAndEmail(params: {
  paymentIntentId: string;
  distributorId: string | null;
  organizationId: string;
  buyerEmail: string | null;
  buyerPhone: string | null;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number | null;
  feeCents: number | null;
  taxCents: number | null;
  totalCents: number;
  logger: Awaited<ReturnType<typeof getLogger>>;
  ctx: { name: string; [key: string]: unknown };
}) {
  const {
    paymentIntentId,
    distributorId,
    organizationId,
    buyerEmail,
    buyerPhone,
    quantity,
    unitPriceCents,
    subtotalCents,
    feeCents,
    taxCents,
    totalCents,
    logger,
    ctx,
  } = params;

  const adminClient = getSupabaseServerAdminClient();

  // Idempotent per PaymentIntent (card_orders.stripe_payment_intent_id UNIQUE):
  // a retry — or a race with the inline confirm path, which calls the same RPC —
  // returns the existing order's cards instead of creating duplicates.
  const { data, error } = await adminClient.rpc('create_digital_card_order', {
    p_organization_id: organizationId,
    p_payment_intent_id: paymentIntentId,
    // Generated args type is non-nullable, but the SQL fn accepts NULL when
    // the buyer didn't fill an email at Stripe checkout.
    p_buyer_email: buyerEmail as string,
    p_quantity: quantity,
    p_unit_price_cents: unitPriceCents,
    // Omit p_distributor_id entirely for org-direct sales so the SQL fn's
    // default (NULL) applies; the generator types it as optional non-null.
    ...(distributorId ? { p_distributor_id: distributorId } : {}),
    ...(buyerPhone ? { p_buyer_phone: buyerPhone } : {}),
    ...(subtotalCents !== null ? { p_subtotal_cents: subtotalCents } : {}),
    ...(feeCents !== null ? { p_fee_cents: feeCents } : {}),
    ...(taxCents !== null ? { p_tax_cents: taxCents } : {}),
    p_total_cents: totalCents,
  });

  const cards = data ?? [];

  if (error || cards.length === 0) {
    logger.error({ ...ctx, error }, 'create_digital_card_order RPC failed');
    return;
  }

  logger.info(
    { ...ctx, cardCount: cards.length, quantity },
    'Digital card order created via webhook',
  );

  if (!buyerEmail) {
    logger.warn(ctx, 'No buyer_email; skipping claim emails');
    return;
  }

  // Skip cards already claimed inline (card #1 in the multi-card flow). Email a
  // claim link for every still-unclaimed card so the buyer has the gift links
  // even if they closed the post-purchase share screen.
  const cardIds = cards.map((c) => c.card_id);

  const { data: claimedRows } = await adminClient
    .from('cards')
    .select('id')
    .in('id', cardIds)
    .not('cardholder_id', 'is', null);

  const claimed = new Set((claimedRows ?? []).map((r) => r.id));

  for (const card of cards) {
    if (claimed.has(card.card_id)) {
      continue;
    }

    const displayCode = formatCardDisplayCode({
      card_type: 'digital',
      card_number: null,
      digital_card_number: card.digital_card_number ?? null,
      organization_prefix: null,
      batch_prefix: null,
    });

    try {
      // REVIEW (multi-card UX): one email per card. A single consolidated
      // "your N cards" email is friendlier for large quantities — needs a new
      // template; deferred.
      await sendDigitalCardClaimEmail({
        email: buyerEmail,
        cardCode: displayCode,
        claimToken: card.claim_token,
      });
    } catch (err) {
      logger.error(
        { ...ctx, email: buyerEmail, cardId: card.card_id, error: err },
        'Failed to send digital claim email',
      );
    }
  }
}

async function handleChargeRefunded(
  charge: Stripe.Charge,
  logger: Awaited<ReturnType<typeof getLogger>>,
) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
  const ctx = {
    name: 'handleChargeRefunded',
    chargeId: charge.id,
    paymentIntentId,
  };

  if (!paymentIntentId) {
    logger.warn(ctx, 'Refund missing payment_intent');
    return;
  }

  const adminClient = getSupabaseServerAdminClient();

  // A multi-card order shares one PaymentIntent across N cards, so cancel every
  // not-already-cancelled card for this payment (a full refund voids the order).
  const { data: cards, error } = await adminClient
    .from('cards')
    .select('id, status')
    .eq('stripe_payment_intent_id', paymentIntentId);

  if (error) {
    logger.error({ ...ctx, error }, 'Failed to load cards for refunded payment');
    return;
  }

  const toCancel = (cards ?? []).filter((c) => c.status !== 'cancelled');

  if (toCancel.length === 0) {
    logger.info(ctx, 'No cancellable cards for refunded payment');
    return;
  }

  const { error: updateError } = await adminClient
    .from('cards')
    .update({ status: 'cancelled' })
    .in(
      'id',
      toCancel.map((c) => c.id),
    );

  if (updateError) {
    logger.error({ ...ctx, error: updateError }, 'Failed to cancel cards');
    return;
  }

  logger.info(
    { ...ctx, cancelledCount: toCancel.length },
    'Cards cancelled due to refund',
  );
}
