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

  await createDigitalCardAndEmail({
    paymentIntentId: paymentIntent.id,
    distributorId,
    organizationId,
    buyerEmail,
    amountCents: paymentIntent.amount,
    logger,
    ctx,
  });
}

async function createDigitalCardAndEmail(params: {
  paymentIntentId: string;
  distributorId: string | null;
  organizationId: string;
  buyerEmail: string | null;
  amountCents: number;
  logger: Awaited<ReturnType<typeof getLogger>>;
  ctx: { name: string; [key: string]: unknown };
}) {
  const {
    paymentIntentId,
    distributorId,
    organizationId,
    buyerEmail,
    amountCents,
    logger,
    ctx,
  } = params;

  const adminClient = getSupabaseServerAdminClient();

  const { data, error } = await adminClient.rpc('create_digital_card', {
    p_organization_id: organizationId,
    p_payment_intent_id: paymentIntentId,
    // Generated args type is non-nullable, but the SQL fn accepts NULL when
    // the buyer didn't fill an email at Stripe checkout.
    p_buyer_email: buyerEmail as string,
    p_price_cents: amountCents,
    // Omit p_distributor_id entirely for org-direct sales so the SQL fn's
    // default (NULL) applies; the generator types it as optional non-null.
    ...(distributorId ? { p_distributor_id: distributorId } : {}),
  });

  const row = data?.[0];

  if (error || !row) {
    logger.error({ ...ctx, error }, 'create_digital_card RPC failed');
    return;
  }

  logger.info(
    { ...ctx, cardId: row.card_id },
    'Digital card created via webhook',
  );

  if (!buyerEmail) {
    logger.warn(
      { ...ctx, cardId: row.card_id },
      'No buyer_email; skipping claim email',
    );
    return;
  }

  const { data: cardRow } = await adminClient
    .from('cards')
    .select('id, digital_card_number, cardholder_id')
    .eq('id', row.card_id)
    .maybeSingle();

  if (cardRow?.cardholder_id) {
    logger.info(
      { ...ctx, cardId: row.card_id },
      'Card already claimed inline; skipping claim email',
    );
    return;
  }

  const displayCode = formatCardDisplayCode({
    card_type: 'digital',
    card_number: null,
    digital_card_number: cardRow?.digital_card_number ?? null,
    organization_prefix: null,
    batch_prefix: null,
  });

  try {
    await sendDigitalCardClaimEmail({
      email: buyerEmail,
      cardCode: displayCode,
      claimToken: row.claim_token,
    });
  } catch (err) {
    logger.error(
      { ...ctx, email: buyerEmail, error: err },
      'Failed to send digital claim email',
    );
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

  const { data: card, error } = await adminClient
    .from('cards')
    .select('id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (error || !card) {
    logger.warn({ ...ctx, error }, 'No card found for refunded payment');
    return;
  }

  if (card.status === 'cancelled') {
    logger.info({ ...ctx, cardId: card.id }, 'Card already cancelled');
    return;
  }

  const { error: updateError } = await adminClient
    .from('cards')
    .update({ status: 'cancelled' })
    .eq('id', card.id);

  if (updateError) {
    logger.error({ ...ctx, error: updateError }, 'Failed to cancel card');
    return;
  }

  logger.info({ ...ctx, cardId: card.id }, 'Card cancelled due to refund');
}
