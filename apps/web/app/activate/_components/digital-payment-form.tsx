'use client';

import { useEffect, useState } from 'react';

import { Elements, loadStripe } from '@kit/stripe/components';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Spinner } from '@kit/ui/spinner';

import {
  confirmActivationErrorMessage,
  createDigitalPaymentIntentErrorMessage,
  validateEmailErrorMessage,
} from '../_lib/activation-errors';
import {
  confirmDigitalPaymentAndActivate,
  createDigitalCardPaymentIntentAction,
  validateEmailForActivation,
} from '../_lib/server/card-activation.actions';
import {
  type ActivationResult,
  type PriceBreakdown,
  SharedPaymentForm,
} from './shared-payment-form';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

export type DigitalPaymentLink =
  | { type: 'distributor'; slug: string }
  | { type: 'organization'; slug: string };

interface DigitalPaymentFormProps {
  link: DigitalPaymentLink;
  onActivated: (result: ActivationResult) => void;
  /** Number of cards to purchase (default 1). Drives the PaymentIntent amount. */
  quantity?: number;
}

export function DigitalPaymentForm({
  link,
  onActivated,
  quantity = 1,
}: DigitalPaymentFormProps) {
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

    initPaymentIntent();

    return () => {
      cancelled = true;
    };
  }, [link.type, link.slug, quantity]);

  if (isCreatingIntent) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-8">
        <Spinner className="h-8 w-8" />
        <p className="text-muted-foreground text-sm">Initializing payment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!clientSecret || !priceBreakdown || !paymentIntentId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to initialize payment form</AlertDescription>
      </Alert>
    );
  }

  return (
    <Elements
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
  );
}
