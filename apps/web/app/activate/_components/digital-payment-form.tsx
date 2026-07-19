'use client';

import { useEffect, useState } from 'react';

import { Elements, loadStripe } from '@kit/stripe/components';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Spinner } from '@kit/ui/spinner';
import { cn } from '@kit/ui/utils';

import {
  confirmActivationErrorMessage,
  createDigitalPaymentIntentErrorMessage,
  validateEmailErrorMessage,
} from '../_lib/activation-errors';
import { MAX_CARD_QUANTITY } from '../_lib/schemas/card-activation.schema';
import {
  attachBuyerContactToPaymentIntent,
  confirmDigitalPaymentAndActivate,
  createDigitalCardPaymentIntentAction,
  validateEmailForActivation,
} from '../_lib/server/card-activation.actions';
import { QuantityStepper } from './quantity-stepper';
import {
  type ActivationResult,
  type PriceBreakdown,
  SharedPaymentForm,
} from './shared-payment-form';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

// Debounce PaymentIntent re-creation while the buyer taps the stepper, so a run
// of clicks doesn't spin up an abandoned PaymentIntent per press.
const QUANTITY_DEBOUNCE_MS = 400;

// Quick-pick anchors beside the stepper (mockup: 1 / 4 / 8 / 12). Deliberate
// price anchoring. Kept within the schema's max.
const QUANTITY_CHIPS = [1, 4, 8, 12].filter((n) => n <= MAX_CARD_QUANTITY);

export type DigitalPaymentLink =
  | { type: 'distributor'; slug: string }
  | { type: 'organization'; slug: string };

interface DigitalPaymentFormProps {
  link: DigitalPaymentLink;
  onActivated: (result: ActivationResult) => void;
  /** Chapter/campaign name, for the "$X toward [Chapter]'s goal" totals headline. */
  orgName: string;
}

export function DigitalPaymentForm({
  link,
  onActivated,
  orgName,
}: DigitalPaymentFormProps) {
  const [quantity, setQuantity] = useState(1);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isCreatingIntent, setIsCreatingIntent] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function initPaymentIntent() {
      setIsCreatingIntent(true);
      setError(null);

      const result = await createDigitalCardPaymentIntentAction({
        slug: link.slug,
        linkType: link.type,
        quantity,
      });

      if (cancelled) return;

      if (result.success && result.clientSecret) {
        setClientSecret(result.clientSecret);
        setPaymentIntentId(result.paymentIntentId ?? null);
        setPriceBreakdown({
          cardCents: (result.subtotalCents ?? 0) - (result.feeCents ?? 0),
          feeCents: result.feeCents ?? 0,
          taxCents: result.taxCents ?? 0,
          totalCents: result.totalCents ?? 0,
        });
      } else if (!result.success) {
        setError(
          `${createDigitalPaymentIntentErrorMessage(result.code)} (Reference: ${result.reference})`,
        );
      }
      setIsCreatingIntent(false);
    }

    // First load fires immediately; quantity changes are debounced.
    const delay = quantity === 1 && clientSecret === null ? 0 : QUANTITY_DEBOUNCE_MS;
    const timer = setTimeout(initPaymentIntent, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.type, link.slug, quantity]);

  return (
    <div className="flex flex-col gap-5">
      <div
        className="bg-sidebar rounded-lg border p-4"
        data-test="quantity-picker"
      >
        <p className="text-base font-extrabold">How many cards?</p>

        <div className="mt-3 flex items-stretch gap-3">
          <QuantityStepper
            value={quantity}
            max={MAX_CARD_QUANTITY}
            disabled={isCreatingIntent}
            onChange={setQuantity}
          />

          <div className="flex flex-1 gap-2">
            {QUANTITY_CHIPS.map((n) => {
              const selected = quantity === n;

              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={selected}
                  data-test={`quantity-chip-${n}`}
                  disabled={isCreatingIntent}
                  onClick={() => setQuantity(n)}
                  className={cn(
                    'flex flex-1 flex-col items-center justify-center rounded-xl border-2 py-2 transition-colors disabled:opacity-60',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <span className="text-base leading-none font-extrabold">
                    {n}
                  </span>
                  <span className="text-muted-foreground mt-0.5 text-[10px] font-semibold">
                    cards
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-primary mt-3 text-[13px] leading-snug font-bold">
          Any extra cards go to friends — text them their cards right after
          purchase to spread the love.
        </p>
      </div>

      {isCreatingIntent ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <Spinner className="h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            {quantity > 1 ? 'Updating your order…' : 'Initializing payment…'}
          </p>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !clientSecret || !priceBreakdown || !paymentIntentId ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to initialize payment form</AlertDescription>
        </Alert>
      ) : (
        <Elements
          // Re-mount the Elements tree whenever the PaymentIntent changes
          // (quantity change) so PaymentElement binds to the new client secret.
          key={clientSecret}
          stripe={stripePromise}
          options={{
            clientSecret,
            locale: 'en',
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#1e3a5f',
                borderRadius: '8px',
              },
            },
          }}
        >
          <SharedPaymentForm
            paymentIntentId={paymentIntentId}
            priceBreakdown={priceBreakdown}
            returnUrl={`${window.location.origin}/activate/${
              link.type === 'organization' ? 'o' : 'd'
            }/${link.slug}`}
            collectPhone
            goalChapterName={orgName}
            showWalletNotice={false}
            attachContact={async (input) => {
              const res = await attachBuyerContactToPaymentIntent(input);
              if (res.success) {
                return { success: true };
              }
              return {
                success: false,
                message: `Could not save your contact details (Reference: ${res.reference})`,
              };
            }}
            validateEmail={async (email) => {
              const res = await validateEmailForActivation({ email });
              if (res.available) {
                return { available: true };
              }
              return {
                available: false,
                message: `${validateEmailErrorMessage(res.code)} (Reference: ${res.reference})`,
              };
            }}
            onConfirm={async (input) => {
              const res = await confirmDigitalPaymentAndActivate({
                slug: link.slug,
                linkType: link.type,
                ...input,
              });
              if (res.success) {
                return res;
              }
              return {
                success: false,
                message: `${confirmActivationErrorMessage(res.code)} (Reference: ${res.reference})`,
              };
            }}
            onActivated={onActivated}
          />
        </Elements>
      )}
    </div>
  );
}
