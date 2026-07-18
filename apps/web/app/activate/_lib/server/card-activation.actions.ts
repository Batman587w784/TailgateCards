'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import { fail, withActionContext } from '~/lib/server/action-context';
import { sendCardholderWelcomeEmail } from '~/lib/server/cardholder-welcome.service';

import {
  ConfirmDigitalPaymentSchema,
  ConfirmPaymentSchema,
  CreateDigitalCardPaymentIntentSchema,
  CreatePaymentIntentSchema,
  VerifyCardSchema,
} from '../schemas/card-activation.schema';
import { fetchDiscountsForOrg } from './card-activation.loader';
import {
  createCardPaymentIntent,
  createDigitalCardPaymentIntent,
  getPaymentIntent,
} from './stripe-card-checkout.service';
import {
  generateTemporaryPassword,
  splitCardholderName,
} from './temp-password';

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

const ValidateEmailSchema = z.object({
  email: z.string().email(),
});

/**
 * Verifies a card code exists and is in valid state for activation.
 * Called in Step 1 when user manually enters a code.
 */
export const verifyCardCode = enhanceAction(
  async (data) =>
    withActionContext('verifyCardCode', async (ctx) => {
      const { cardCode } = data;

      const client = getSupabaseServerClient();

      const parsed = parseDisplayCode(cardCode);
      if (!parsed) {
        return fail(ctx, 'INVALID_CODE_FORMAT', { detail: { cardCode } });
      }

      // Find organization by card_prefix
      const { data: org, error: orgError } = await client
        .from('accounts')
        .select('id, name, card_prefix')
        .eq('card_prefix', parsed.orgPrefix)
        .single();

      if (orgError || !org) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { cardCode, stage: 'org', error: orgError?.message },
        });
      }

      // Find batch by prefix
      const { data: batch, error: batchError } = await client
        .from('batches')
        .select('id')
        .eq('organization_id', org.id)
        .eq('prefix', parsed.batchPrefix)
        .single();

      if (batchError || !batch) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { cardCode, stage: 'batch', error: batchError?.message },
        });
      }

      // Find card by batch and card_number
      const { data: card, error: cardError } = await client
        .from('cards')
        .select('id, card_number, status, organization_id, price_cents')
        .eq('batch_id', batch.id)
        .eq('card_number', parsed.cardNumber)
        .single();

      if (cardError || !card) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { cardCode, stage: 'card', error: cardError?.message },
        });
      }

      // Check card status
      if (card.status === 'activated') {
        return fail(ctx, 'CARD_ALREADY_ACTIVATED', { detail: { cardCode } });
      }

      if (card.status === 'expired') {
        return fail(ctx, 'CARD_EXPIRED', { detail: { cardCode } });
      }

      if (card.status === 'cancelled') {
        return fail(ctx, 'CARD_CANCELLED', { detail: { cardCode } });
      }

      // Get organization card price
      const { data: orgProfile } = await client
        .from('organization_profiles')
        .select('card_price_cents')
        .eq('account_id', card.organization_id)
        .single();

      const priceCents =
        orgProfile?.card_price_cents ?? card.price_cents ?? 2500;

      ctx.logger.info(
        {
          name: ctx.name,
          reference: ctx.reference,
          cardCode,
          status: card.status,
        },
        'Card verified',
      );

      return {
        success: true as const,
        card: {
          id: card.id,
          display_code: cardCode.toUpperCase(),
          status: card.status,
          price_cents: priceCents,
          organization: {
            id: org.id,
            name: org.name ?? 'Unknown Organization',
          },
        },
      };
    }),
  {
    schema: VerifyCardSchema,
    auth: false,
  },
);

// =============================================================================
// STRIPE PAYMENT FLOW
// =============================================================================

/**
 * Validates that an email can be used for card activation.
 * Checks if the email already has a card associated with it.
 * Called BEFORE payment to prevent charging users who can't activate.
 */
export const validateEmailForActivation = enhanceAction(
  async (data) =>
    withActionContext('validateEmailForActivation', async (ctx) => {
      const { email } = data;
      const adminClient = getSupabaseServerAdminClient();

      // Check if user with this email already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === email);

      if (!existingUser) {
        // New user - email is available
        return { success: true as const, available: true as const };
      }

      // User exists - check if they already have a card
      const { data: personalAccount } = await adminClient
        .from('accounts')
        .select('id')
        .eq('primary_owner_user_id', existingUser.id)
        .eq('is_personal_account', true)
        .single();

      if (!personalAccount) {
        // Account not found - shouldn't happen but allow
        ctx.logger.warn(
          { name: ctx.name, reference: ctx.reference, email },
          'Existing user without personal account',
        );
        return { success: true as const, available: true as const };
      }

      // Check if user already has a card
      const { data: existingCard } = await adminClient
        .from('cards')
        .select('id')
        .eq('cardholder_id', personalAccount.id)
        .maybeSingle();

      if (existingCard) {
        ctx.logger.info(
          { name: ctx.name, reference: ctx.reference, email },
          'Email already has a card associated',
        );
        // Soft-fail on a success envelope: the lookup succeeded, but the email
        // is unavailable. Carry a `code` + `reference` instead of a free string.
        return {
          success: true as const,
          available: false as const,
          code: 'EMAIL_HAS_CARD' as const,
          reference: ctx.reference,
        };
      }

      return { success: true as const, available: true as const };
    }),
  {
    schema: ValidateEmailSchema,
    auth: false,
  },
);

/**
 * Creates a PaymentIntent for card activation with Stripe Elements.
 * Fetches price from Stripe Product and calculates tax.
 * Called when component mounts to initialize payment form.
 */
export const createPaymentIntentAction = enhanceAction(
  async (data) =>
    withActionContext('createPaymentIntentAction', async (ctx) => {
      const { cardCode } = data;

      const adminClient = getSupabaseServerAdminClient();

      const parsed = parseDisplayCode(cardCode);
      if (!parsed) {
        return fail(ctx, 'INVALID_CODE_FORMAT', { detail: { cardCode } });
      }

      // Find organization by card_prefix
      const { data: org, error: orgError } = await adminClient
        .from('accounts')
        .select('id, name, card_prefix')
        .eq('card_prefix', parsed.orgPrefix)
        .single();

      if (orgError || !org) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { cardCode, stage: 'org', error: orgError?.message },
          level: 'error',
        });
      }

      // Find batch by prefix
      const { data: batch, error: batchError } = await adminClient
        .from('batches')
        .select('id')
        .eq('organization_id', org.id)
        .eq('prefix', parsed.batchPrefix)
        .single();

      if (batchError || !batch) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { cardCode, stage: 'batch', error: batchError?.message },
          level: 'error',
        });
      }

      // Find card
      const { data: card, error: cardError } = await adminClient
        .from('cards')
        .select('id, status')
        .eq('batch_id', batch.id)
        .eq('card_number', parsed.cardNumber)
        .single();

      if (cardError || !card) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { cardCode, stage: 'card', error: cardError?.message },
          level: 'error',
        });
      }

      // Verify card can be paid for
      if (card.status !== 'pending') {
        return fail(ctx, 'CARD_NOT_PURCHASABLE', {
          detail: { cardCode, status: card.status },
        });
      }

      const { data: orgProfile } = await adminClient
        .from('organization_profiles')
        .select('card_price_cents')
        .eq('account_id', org.id)
        .single();

      const priceCents = orgProfile?.card_price_cents ?? 2500;

      const {
        clientSecret,
        paymentIntentId,
        subtotalCents,
        feeCents,
        taxCents,
        totalCents,
      } = await createCardPaymentIntent({
        cardId: card.id,
        cardCode: cardCode.toUpperCase(),
        organizationId: org.id,
        organizationName: org.name ?? 'Tailgate',
        priceCents,
      });

      ctx.logger.info(
        {
          name: ctx.name,
          reference: ctx.reference,
          cardCode,
          paymentIntentId,
          subtotalCents,
          feeCents,
          taxCents,
          totalCents,
        },
        'PaymentIntent created successfully',
      );

      return {
        success: true as const,
        clientSecret,
        paymentIntentId,
        subtotalCents,
        feeCents,
        taxCents,
        totalCents,
      };
    }),
  {
    schema: CreatePaymentIntentSchema,
    auth: false,
  },
);

/**
 * Confirms payment was successful and activates the card.
 * Called after Stripe payment confirmation on the client.
 * Email is provided from the client form (collected inline with payment).
 */
export const confirmPaymentAndActivate = enhanceAction(
  async (data) =>
    withActionContext('confirmPaymentAndActivate', async (ctx) => {
      const {
        cardCode,
        paymentIntentId,
        email,
        country,
        postalCode,
        cardholderName,
        termsAccepted,
        marketingOptIn,
      } = data;

      const adminClient = getSupabaseServerAdminClient();

      // Verify the payment was successful
      const paymentIntent = await getPaymentIntent(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return fail(ctx, 'PAYMENT_NOT_SUCCEEDED', {
          detail: { paymentIntentId, status: paymentIntent.status },
          level: 'error',
        });
      }

      // Verify the payment is for this card
      if (paymentIntent.metadata.card_code !== cardCode.toUpperCase()) {
        return fail(ctx, 'PAYMENT_VERIFICATION_FAILED', {
          detail: { paymentIntentId, cardCode, reason: 'metadata mismatch' },
          level: 'error',
        });
      }

      // Idempotency: if this PaymentIntent has already activated a card, return
      // the existing result. Lets the client retry finalize without rerunning
      // Stripe confirmation (which would error with "PaymentIntent has already
      // succeeded").
      const { data: alreadyActivated } = await adminClient
        .from('cards')
        .select('id, cardholder_id, stripe_customer_email')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .not('cardholder_id', 'is', null)
        .maybeSingle();

      if (alreadyActivated?.cardholder_id) {
        ctx.logger.info(
          {
            name: ctx.name,
            reference: ctx.reference,
            paymentIntentId,
            cardId: alreadyActivated.id,
          },
          'PaymentIntent already finalized; returning existing activation',
        );
        return {
          success: true as const,
          accountId: alreadyActivated.cardholder_id,
          cardCode: cardCode.toUpperCase(),
          email: alreadyActivated.stripe_customer_email ?? email,
        };
      }

      const parsed = parseDisplayCode(cardCode);
      if (!parsed) {
        return fail(ctx, 'INVALID_CODE_FORMAT', { detail: { cardCode } });
      }

      // Find organization
      const { data: org, error: orgError } = await adminClient
        .from('accounts')
        .select('id, card_prefix')
        .eq('card_prefix', parsed.orgPrefix)
        .single();

      if (orgError || !org) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { cardCode, stage: 'org', error: orgError?.message },
          level: 'error',
        });
      }

      // Find batch by prefix
      const { data: batch, error: batchError } = await adminClient
        .from('batches')
        .select('id')
        .eq('organization_id', org.id)
        .eq('prefix', parsed.batchPrefix)
        .single();

      if (batchError || !batch) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { cardCode, stage: 'batch', error: batchError?.message },
          level: 'error',
        });
      }

      // Find card
      const { data: card, error: cardError } = await adminClient
        .from('cards')
        .select('id, status')
        .eq('batch_id', batch.id)
        .eq('card_number', parsed.cardNumber)
        .single();

      if (cardError || !card) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { cardCode, stage: 'card', error: cardError?.message },
          level: 'error',
        });
      }

      // Verify card is still pending (hasn't been activated by webhook yet)
      if (card.status !== 'pending' && card.status !== 'paid') {
        if (card.status === 'activated') {
          ctx.logger.info(
            { name: ctx.name, reference: ctx.reference, cardCode },
            'Card already activated, proceeding to profile',
          );
        } else {
          return fail(ctx, 'CARD_NOT_ACTIVATABLE', {
            detail: { cardCode, status: card.status },
          });
        }
      }

      // Check if user with this email already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === email);

      let userId: string;
      let accountId: string;
      let isNewUser = false;
      let tempPassword: string | null = null;

      if (existingUser) {
        userId = existingUser.id;

        const { data: personalAccount, error: accountError } = await adminClient
          .from('accounts')
          .select('id')
          .eq('primary_owner_user_id', userId)
          .eq('is_personal_account', true)
          .single();

        if (accountError || !personalAccount) {
          return fail(ctx, 'ACCOUNT_SETUP_INCOMPLETE', {
            detail: { email, error: accountError?.message },
            level: 'error',
          });
        }

        accountId = personalAccount.id;

        // Check if user already has a different card (one card per email
        // lifetime limit). Exclude the card we're activating so retries against
        // the same card row don't false-positive on themselves.
        const { data: existingCard } = await adminClient
          .from('cards')
          .select('id')
          .eq('cardholder_id', accountId)
          .neq('id', card.id)
          .maybeSingle();

        if (existingCard) {
          return fail(ctx, 'EMAIL_HAS_CARD', { detail: { email, accountId } });
        }

        ctx.logger.info(
          { name: ctx.name, reference: ctx.reference, email, userId },
          'Using existing user account',
        );
      } else {
        // Create new user with a temporary password we'll email them. Avoids the
        // Supabase invite-email path and lets them sign in immediately after
        // activation without us having to mint a magic link.
        ctx.logger.info(
          { name: ctx.name, reference: ctx.reference, email },
          'Creating new user',
        );

        tempPassword = generateTemporaryPassword();

        const { data: userData, error: userError } =
          await adminClient.auth.admin.createUser({
            email,
            email_confirm: true,
            password: tempPassword,
            user_metadata: {
              platform_role: 'cardholder',
              requires_password_reset: true,
            },
          });

        if (userError || !userData.user) {
          return fail(ctx, 'ACCOUNT_CREATION_FAILED', {
            detail: { email, error: userError?.message },
            level: 'error',
          });
        }

        userId = userData.user.id;
        isNewUser = true;

        // The `on_auth_user_created` trigger (kit.setup_new_user) runs AFTER
        // INSERT in the same transaction as the auth insert, so the personal
        // account row is guaranteed to exist by the time createUser resolves.
        const { data: newPersonalAccount, error: newAccountError } =
          await adminClient
            .from('accounts')
            .select('id')
            .eq('primary_owner_user_id', userId)
            .eq('is_personal_account', true)
            .single();

        if (newAccountError || !newPersonalAccount) {
          return fail(ctx, 'ACCOUNT_CREATION_FAILED', {
            detail: { userId, error: newAccountError?.message },
            level: 'error',
          });
        }

        accountId = newPersonalAccount.id;
        ctx.logger.info(
          {
            name: ctx.name,
            reference: ctx.reference,
            email,
            userId,
            accountId,
          },
          'New user created successfully',
        );
      }

      // Calculate expiration (1 year from now)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      // Get price from PaymentIntent (total amount charged)
      const priceCents = paymentIntent.amount;

      // Activate the card (only if not already activated and cardholder_id is null)
      if (card.status !== 'activated') {
        const { error: updateError } = await adminClient
          .from('cards')
          .update({
            status: 'activated',
            cardholder_id: accountId,
            activated_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            stripe_payment_intent_id: paymentIntentId,
            stripe_customer_email: email,
            price_cents: priceCents,
            paid_at: new Date().toISOString(),
          })
          .eq('id', card.id)
          .is('cardholder_id', null);

        if (updateError) {
          // Handle unique constraint violation (race condition)
          if (
            updateError.code === '23505' &&
            updateError.message?.includes('ix_cards_cardholder_unique')
          ) {
            return fail(ctx, 'EMAIL_HAS_CARD', {
              detail: {
                email,
                accountId,
                reason: 'constraint violation (race condition)',
              },
            });
          }

          return fail(ctx, 'ACTIVATION_FAILED', {
            detail: { cardId: card.id, error: updateError.message },
            level: 'error',
          });
        }
      }

      const { firstName, lastName } = splitCardholderName(cardholderName);

      // Create or update cardholder profile.
      const { error: profileError } = await adminClient
        .from('cardholder_profiles')
        .upsert(
          {
            account_id: accountId,
            first_name: firstName,
            last_name: lastName,
            country,
            postal_code: postalCode,
            stripe_customer_id: paymentIntent.customer as string | null,
            terms_accepted: termsAccepted,
            marketing_opt_in: marketingOptIn,
          },
          {
            onConflict: 'account_id',
          },
        );

      if (profileError) {
        ctx.logger.warn(
          {
            name: ctx.name,
            reference: ctx.reference,
            accountId,
            error: profileError.message,
          },
          'Failed to update cardholder profile',
        );
      }

      // Also surface the name on the accounts row so the dashboard greets the
      // user by their cardholder name even before they complete their profile.
      await adminClient
        .from('accounts')
        .update({
          name: lastName ? `${firstName} ${lastName}` : firstName,
        })
        .eq('id', accountId);

      ctx.logger.info(
        {
          name: ctx.name,
          reference: ctx.reference,
          cardCode,
          email,
          accountId,
        },
        'Card activated successfully via Stripe',
      );

      // Send welcome email for new users (not Supabase invite). Include the temp
      // password they need to sign in for the first time.
      if (isNewUser) {
        try {
          await sendCardholderWelcomeEmail({
            email,
            cardCode: cardCode.toUpperCase(),
            temporaryPassword: tempPassword ?? undefined,
          });
          ctx.logger.info(
            { name: ctx.name, reference: ctx.reference, email },
            'Welcome email sent to new cardholder',
          );
        } catch (emailError) {
          // Don't fail activation if email sending fails
          ctx.logger.error(
            {
              name: ctx.name,
              reference: ctx.reference,
              email,
              error: emailError,
            },
            'Failed to send welcome email',
          );
        }
      }

      return {
        success: true as const,
        accountId,
        cardCode: cardCode.toUpperCase(),
        email,
      };
    }),
  {
    schema: ConfirmPaymentSchema,
    auth: false,
  },
);

// =============================================================================
// DIGITAL CARD FLOW (M6)
// =============================================================================

/**
 * Creates a Stripe PaymentIntent for an inline digital-card purchase tied to a
 * specific distributor's share slug. The card row is not created here — it is
 * created by `confirmDigitalPaymentAndActivate` (or, as backup, by the Stripe
 * webhook) once payment succeeds. Both paths call the idempotent
 * `create_digital_card` RPC.
 */
export const createDigitalCardPaymentIntentAction = enhanceAction(
  async (data) =>
    withActionContext('createDigitalCardPaymentIntent', async (ctx) => {
      const { slug, linkType, quantity } = data;

      const adminClient = getSupabaseServerAdminClient();

      let organizationId: string;
      let organizationName: string;
      let priceCents: number;
      let distributorAccountId: string | null = null;

      if (linkType === 'organization') {
        const { data: rows, error } = await adminClient.rpc(
          'get_organization_buy_page',
          { p_slug: slug },
        );

        const row = rows?.[0];

        if (error || !row) {
          return fail(ctx, 'ORGANIZATION_LINK_NOT_FOUND', {
            detail: { slug, error: error?.message },
          });
        }

        organizationId = row.organization_id;
        organizationName = row.organization_name ?? 'Tailgate';
        priceCents = row.price_cents ?? 2500;
      } else {
        const { data: rows, error } = await adminClient.rpc(
          'get_distributor_buy_page',
          { p_slug: slug },
        );

        const row = rows?.[0];

        if (error || !row) {
          return fail(ctx, 'DISTRIBUTOR_LINK_NOT_FOUND', {
            detail: { slug, error: error?.message },
          });
        }

        organizationId = row.organization_id;
        organizationName = row.organization_name ?? 'Tailgate';
        priceCents = row.price_cents ?? 2500;
        distributorAccountId = row.distributor_id;
      }

      try {
        const {
          clientSecret,
          paymentIntentId,
          subtotalCents,
          feeCents,
          taxCents,
          totalCents,
        } = await createDigitalCardPaymentIntent({
          distributorAccountId,
          organizationId,
          organizationName,
          priceCents,
          quantity,
        });

        ctx.logger.info(
          {
            name: ctx.name,
            reference: ctx.reference,
            slug,
            linkType,
            paymentIntentId,
            distributorId: distributorAccountId,
            organizationId,
          },
          'Created digital card payment intent',
        );

        return {
          success: true as const,
          clientSecret,
          paymentIntentId,
          quantity,
          unitPriceCents: priceCents,
          subtotalCents,
          feeCents,
          taxCents,
          totalCents,
        };
      } catch (err) {
        return fail(ctx, 'PAYMENT_INTENT_FAILED', {
          detail: {
            slug,
            linkType,
            error: err instanceof Error ? err.message : String(err),
          },
          level: 'error',
        });
      }
    }),
  {
    schema: CreateDigitalCardPaymentIntentSchema,
    auth: false,
  },
);

/**
 * Confirms a digital-card payment and activates the card for the buyer inline.
 * Idempotently creates the card via `create_digital_card`, then claims it for
 * the user, mirroring `confirmPaymentAndActivate` for physical cards.
 */
export const confirmDigitalPaymentAndActivate = enhanceAction(
  async (data) =>
    withActionContext('confirmDigitalPaymentAndActivate', async (ctx) => {
      const {
        slug,
        linkType,
        paymentIntentId,
        email,
        country,
        postalCode,
        cardholderName,
        termsAccepted,
        marketingOptIn,
      } = data;

      const adminClient = getSupabaseServerAdminClient();

      const paymentIntent = await getPaymentIntent(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return fail(ctx, 'PAYMENT_NOT_SUCCEEDED', {
          detail: { paymentIntentId, status: paymentIntent.status },
          level: 'error',
        });
      }

      if (paymentIntent.metadata.kind !== 'digital_card') {
        return fail(ctx, 'PAYMENT_VERIFICATION_FAILED', {
          detail: { paymentIntentId, reason: 'not a digital card' },
          level: 'error',
        });
      }

      let resolvedOrganizationId: string;
      let resolvedDistributorId: string | null = null;

      if (linkType === 'organization') {
        const { data: orgRows, error: orgError } = await adminClient.rpc(
          'get_organization_buy_page',
          { p_slug: slug },
        );

        const org = orgRows?.[0];

        if (orgError || !org) {
          return fail(ctx, 'ORGANIZATION_LINK_NOT_FOUND', {
            detail: { slug, error: orgError?.message },
            level: 'error',
          });
        }

        resolvedOrganizationId = org.organization_id;
      } else {
        const { data: distributorRows, error: distributorError } =
          await adminClient.rpc('get_distributor_buy_page', { p_slug: slug });

        const distributor = distributorRows?.[0];

        if (distributorError || !distributor) {
          return fail(ctx, 'DISTRIBUTOR_LINK_NOT_FOUND', {
            detail: { slug, error: distributorError?.message },
            level: 'error',
          });
        }

        resolvedOrganizationId = distributor.organization_id;
        resolvedDistributorId = distributor.distributor_id;
      }

      if (paymentIntent.metadata.organization_id !== resolvedOrganizationId) {
        return fail(ctx, 'PAYMENT_VERIFICATION_FAILED', {
          detail: {
            paymentIntentId,
            slug,
            linkType,
            reason: 'organization mismatch',
          },
          level: 'error',
        });
      }

      if (resolvedDistributorId === null) {
        if (paymentIntent.metadata.distributor_id) {
          return fail(ctx, 'PAYMENT_VERIFICATION_FAILED', {
            detail: {
              paymentIntentId,
              slug,
              reason: 'org link received distributor metadata',
            },
            level: 'error',
          });
        }
      } else if (
        paymentIntent.metadata.distributor_id !== resolvedDistributorId
      ) {
        return fail(ctx, 'PAYMENT_VERIFICATION_FAILED', {
          detail: { paymentIntentId, slug, reason: 'distributor mismatch' },
          level: 'error',
        });
      }

      // Idempotency: if this PaymentIntent has already activated a card, return
      // the existing result. Lets the client retry finalize without rerunning
      // Stripe confirmation.
      const { data: alreadyActivated } = await adminClient
        .from('cards')
        .select('id, cardholder_id, digital_card_number, stripe_customer_email')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .not('cardholder_id', 'is', null)
        .maybeSingle();

      if (alreadyActivated?.cardholder_id) {
        ctx.logger.info(
          {
            name: ctx.name,
            reference: ctx.reference,
            paymentIntentId,
            cardId: alreadyActivated.id,
          },
          'Digital PaymentIntent already finalized; returning existing activation',
        );
        return {
          success: true as const,
          accountId: alreadyActivated.cardholder_id,
          cardCode: formatCardDisplayCode({
            card_type: 'digital',
            card_number: null,
            digital_card_number: alreadyActivated.digital_card_number ?? null,
            organization_prefix: null,
            batch_prefix: null,
          }),
          email: alreadyActivated.stripe_customer_email ?? email,
        };
      }

      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === email);

      let userId: string;
      let accountId: string;
      let isNewUser = false;
      let tempPassword: string | null = null;

      if (existingUser) {
        userId = existingUser.id;

        const { data: personalAccount, error: personalError } =
          await adminClient
            .from('accounts')
            .select('id')
            .eq('primary_owner_user_id', userId)
            .eq('is_personal_account', true)
            .single();

        if (personalError || !personalAccount) {
          return fail(ctx, 'ACCOUNT_SETUP_INCOMPLETE', {
            detail: { email, error: personalError?.message },
            level: 'error',
          });
        }

        accountId = personalAccount.id;

        const { data: existingCard } = await adminClient
          .from('cards')
          .select('id')
          .eq('cardholder_id', accountId)
          .maybeSingle();

        if (existingCard) {
          return fail(ctx, 'EMAIL_HAS_CARD', { detail: { email, accountId } });
        }
      } else {
        tempPassword = generateTemporaryPassword();

        const { data: userData, error: userError } =
          await adminClient.auth.admin.createUser({
            email,
            email_confirm: true,
            password: tempPassword,
            user_metadata: {
              platform_role: 'cardholder',
              requires_password_reset: true,
            },
          });

        if (userError || !userData.user) {
          return fail(ctx, 'ACCOUNT_CREATION_FAILED', {
            detail: { email, error: userError?.message },
            level: 'error',
          });
        }

        userId = userData.user.id;
        isNewUser = true;

        // Trigger `on_auth_user_created` runs in the same transaction as the
        // auth insert, so the personal account row exists by the time
        // createUser resolves.
        const { data: newPersonalAccount, error: newAccountError } =
          await adminClient
            .from('accounts')
            .select('id')
            .eq('primary_owner_user_id', userId)
            .eq('is_personal_account', true)
            .single();

        if (newAccountError || !newPersonalAccount) {
          return fail(ctx, 'ACCOUNT_CREATION_FAILED', {
            detail: { userId, error: newAccountError?.message },
            level: 'error',
          });
        }

        accountId = newPersonalAccount.id;
      }

      const { data: cardRows, error: cardError } = await adminClient.rpc(
        'create_digital_card',
        {
          p_organization_id: resolvedOrganizationId,
          p_payment_intent_id: paymentIntentId,
          p_buyer_email: email,
          p_price_cents: paymentIntent.amount,
          // Omit p_distributor_id entirely on org-direct sales so the SQL
          // default (NULL) applies; the generator types it as optional non-null.
          ...(resolvedDistributorId
            ? { p_distributor_id: resolvedDistributorId }
            : {}),
        },
      );

      const cardRow = cardRows?.[0];

      if (cardError || !cardRow) {
        return fail(ctx, 'CARD_CREATION_FAILED', {
          detail: { paymentIntentId, error: cardError?.message },
          level: 'error',
        });
      }

      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const { error: updateError } = await adminClient
        .from('cards')
        .update({
          status: 'activated',
          cardholder_id: accountId,
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', cardRow.card_id)
        .is('cardholder_id', null);

      if (updateError) {
        if (
          updateError.code === '23505' &&
          updateError.message?.includes('ix_cards_cardholder_unique')
        ) {
          return fail(ctx, 'EMAIL_HAS_CARD', {
            detail: {
              cardId: cardRow.card_id,
              reason: 'constraint violation (race condition)',
            },
          });
        }
        return fail(ctx, 'ACTIVATION_FAILED', {
          detail: { cardId: cardRow.card_id, error: updateError.message },
          level: 'error',
        });
      }

      const { firstName, lastName } = splitCardholderName(cardholderName);

      const { error: profileError } = await adminClient
        .from('cardholder_profiles')
        .upsert(
          {
            account_id: accountId,
            first_name: firstName,
            last_name: lastName,
            country,
            postal_code: postalCode,
            stripe_customer_id: paymentIntent.customer as string | null,
            terms_accepted: termsAccepted,
            marketing_opt_in: marketingOptIn,
          },
          { onConflict: 'account_id' },
        );

      if (profileError) {
        ctx.logger.warn(
          {
            name: ctx.name,
            reference: ctx.reference,
            accountId,
            error: profileError.message,
          },
          'Failed to update cardholder profile',
        );
      }

      await adminClient
        .from('accounts')
        .update({
          name: lastName ? `${firstName} ${lastName}` : firstName,
        })
        .eq('id', accountId);

      const { data: activatedCard } = await adminClient
        .from('cards')
        .select('digital_card_number')
        .eq('id', cardRow.card_id)
        .maybeSingle();

      const displayCode = formatCardDisplayCode({
        card_type: 'digital',
        card_number: null,
        digital_card_number: activatedCard?.digital_card_number ?? null,
        organization_prefix: null,
        batch_prefix: null,
      });

      if (isNewUser) {
        try {
          await sendCardholderWelcomeEmail({
            email,
            cardCode: displayCode,
            temporaryPassword: tempPassword ?? undefined,
          });
        } catch (emailErr) {
          ctx.logger.error(
            {
              name: ctx.name,
              reference: ctx.reference,
              email,
              error: emailErr,
            },
            'Failed to send welcome email',
          );
        }
      }

      ctx.logger.info(
        {
          name: ctx.name,
          reference: ctx.reference,
          cardId: cardRow.card_id,
          accountId,
        },
        'Digital card activated inline',
      );

      return {
        success: true as const,
        accountId,
        cardCode: displayCode,
        email,
      };
    }),
  {
    schema: ConfirmDigitalPaymentSchema,
    auth: false,
  },
);

const ClaimDigitalCardSchema = z.object({
  claimToken: z.string().min(1),
  email: z.string().email(),
  country: z.string().min(2),
  postalCode: z.string().min(1),
  cardholderName: z
    .string()
    .trim()
    .min(2, 'Please enter the full name on the card')
    .max(80, 'Cardholder name must be less than 80 characters'),
  termsAccepted: z
    .boolean()
    .refine((v) => v === true, { message: 'Terms must be accepted' }),
  marketingOptIn: z.boolean().optional().default(false),
});

/**
 * Claims a digital card after payment. Looks up the card by claim_token, then
 * mirrors the account-create / activate logic from confirmPaymentAndActivate.
 * No payment verification — that already happened in the webhook before this
 * row was inserted.
 */
export const claimDigitalCard = enhanceAction(
  async (data) =>
    withActionContext('claimDigitalCard', async (ctx) => {
      const {
        claimToken,
        email,
        country,
        postalCode,
        cardholderName,
        termsAccepted,
        marketingOptIn,
      } = data;

      const adminClient = getSupabaseServerAdminClient();

      const { data: rows, error: lookupError } = await adminClient.rpc(
        'get_digital_card_for_activation',
        { p_claim_token: claimToken },
      );

      const card = rows?.[0];

      if (lookupError || !card) {
        return fail(ctx, 'CARD_NOT_FOUND', {
          detail: { error: lookupError?.message },
        });
      }

      if (card.cardholder_id) {
        return fail(ctx, 'CARD_ALREADY_ACTIVATED', {
          detail: { cardId: card.id },
        });
      }

      if (card.status === 'cancelled') {
        return fail(ctx, 'CARD_CANCELLED', { detail: { cardId: card.id } });
      }

      if (card.status === 'expired') {
        return fail(ctx, 'CARD_EXPIRED', { detail: { cardId: card.id } });
      }

      // Look up or create the user account.
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === email);

      let userId: string;
      let accountId: string;
      let isNewUser = false;
      let tempPassword: string | null = null;

      if (existingUser) {
        userId = existingUser.id;

        const { data: personalAccount, error: personalError } =
          await adminClient
            .from('accounts')
            .select('id')
            .eq('primary_owner_user_id', userId)
            .eq('is_personal_account', true)
            .single();

        if (personalError || !personalAccount) {
          return fail(ctx, 'ACCOUNT_SETUP_INCOMPLETE', {
            detail: { email, error: personalError?.message },
            level: 'error',
          });
        }

        accountId = personalAccount.id;

        const { data: existingCard } = await adminClient
          .from('cards')
          .select('id')
          .eq('cardholder_id', accountId)
          .maybeSingle();

        if (existingCard) {
          return fail(ctx, 'EMAIL_HAS_CARD', { detail: { email, accountId } });
        }
      } else {
        tempPassword = generateTemporaryPassword();

        const { data: userData, error: userError } =
          await adminClient.auth.admin.createUser({
            email,
            email_confirm: true,
            password: tempPassword,
            user_metadata: {
              platform_role: 'cardholder',
              requires_password_reset: true,
            },
          });

        if (userError || !userData.user) {
          return fail(ctx, 'ACCOUNT_CREATION_FAILED', {
            detail: { email, error: userError?.message },
            level: 'error',
          });
        }

        userId = userData.user.id;
        isNewUser = true;

        await new Promise((resolve) => setTimeout(resolve, 500));

        const { data: newPersonalAccount, error: newAccountError } =
          await adminClient
            .from('accounts')
            .select('id')
            .eq('primary_owner_user_id', userId)
            .eq('is_personal_account', true)
            .single();

        if (newAccountError || !newPersonalAccount) {
          return fail(ctx, 'ACCOUNT_CREATION_FAILED', {
            detail: { userId, error: newAccountError?.message },
            level: 'error',
          });
        }

        accountId = newPersonalAccount.id;
      }

      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const { error: updateError } = await adminClient
        .from('cards')
        .update({
          status: 'activated',
          cardholder_id: accountId,
          activated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', card.id)
        .is('cardholder_id', null);

      if (updateError) {
        if (
          updateError.code === '23505' &&
          updateError.message?.includes('ix_cards_cardholder_unique')
        ) {
          return fail(ctx, 'EMAIL_HAS_CARD', {
            detail: {
              cardId: card.id,
              reason: 'constraint violation (race condition)',
            },
          });
        }
        return fail(ctx, 'ACTIVATION_FAILED', {
          detail: { cardId: card.id, error: updateError.message },
          level: 'error',
        });
      }

      const { firstName, lastName } = splitCardholderName(cardholderName);

      await adminClient.from('cardholder_profiles').upsert(
        {
          account_id: accountId,
          first_name: firstName,
          last_name: lastName,
          country,
          postal_code: postalCode,
          terms_accepted: termsAccepted,
          marketing_opt_in: marketingOptIn,
        },
        { onConflict: 'account_id' },
      );

      await adminClient
        .from('accounts')
        .update({
          name: lastName ? `${firstName} ${lastName}` : firstName,
        })
        .eq('id', accountId);

      const displayCode = formatCardDisplayCode({
        card_type: 'digital',
        card_number: null,
        digital_card_number: card.digital_card_number ?? null,
        organization_prefix: null,
        batch_prefix: null,
      });

      if (isNewUser) {
        try {
          await sendCardholderWelcomeEmail({
            email,
            cardCode: displayCode,
            temporaryPassword: tempPassword ?? undefined,
          });
        } catch (emailErr) {
          ctx.logger.error(
            {
              name: ctx.name,
              reference: ctx.reference,
              email,
              error: emailErr,
            },
            'Failed to send welcome email',
          );
        }
      }

      ctx.logger.info(
        {
          name: ctx.name,
          reference: ctx.reference,
          cardId: card.id,
          accountId,
        },
        'Digital card claimed successfully',
      );

      return {
        success: true as const,
        accountId,
        cardCode: displayCode,
        email,
      };
    }),
  {
    schema: ClaimDigitalCardSchema,
    auth: false,
  },
);

const GetDiscountPreviewSchema = z.object({
  organizationId: z.string().uuid(),
});

export const getOrganizationDiscountPreview = enhanceAction(
  async (data) =>
    withActionContext('getOrganizationDiscountPreview', async () => {
      const adminClient = getSupabaseServerAdminClient();
      const discounts = await fetchDiscountsForOrg(
        adminClient,
        data.organizationId,
      );

      return { success: true as const, discounts };
    }),
  {
    schema: GetDiscountPreviewSchema,
    auth: false,
  },
);
