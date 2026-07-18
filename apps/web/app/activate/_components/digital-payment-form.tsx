'use client';

import { useEffect, useState } from 'react';

import { Elements, loadStripe } from '@kit/stripe/components';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Spinner } from '@kit/ui/spinner';

import { formatUsdFromCents } from '~/lib/currency';

import {
  confirmActivationErrorMessage,
  createDigitalPaymentIntentErrorMessage,
  validateEmailErrorMessage,
} from '../_lib/activation-errors';
import { MAX_CARD_QUANTITY } from '../_lib/schemas/card-activation.schema';
import {
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

export type DigitalPaymentLink =
  | { type: 'distributor'; slug: string }
  | { type: 'organization'; slug: string };

interface DigitalPaymentFormProps {
  link: DigitalPaymentLink;
  onActivated: (result: ActivationResult) => void;
  /** Unit price of a single card, for the quantity subtotal preview. */
  unitPriceCents: number;
}

export function DigitalPaymentForm({
  link,
  onActivated,
  unitPriceCents,
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
        className="bg-sidebar flex items-center justify-between rounded-lg border p-4"
        data-test="quantity-picker"
      >
        <div>
          <p className="text-sm font-medium">How many cards?</p>
          <p className="text-muted-foreground text-xs">
            {formatUsdFromCents(unitPriceCents)} each · buy extras to gift
          </p>
        </div>
        <QuantityStepper
          value={quantity}
          max={MAX_CARD_QUANTITY}
          disabled={isCreatingIntent}
          onChange={setQuantity}
        />
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
