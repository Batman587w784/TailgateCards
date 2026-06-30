'use client';

import { useEffect, useState } from 'react';

import { Elements, loadStripe } from '@kit/stripe/components';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Spinner } from '@kit/ui/spinner';

import {
  confirmActivationErrorMessage,
  createPaymentIntentErrorMessage,
  validateEmailErrorMessage,
} from '../_lib/activation-errors';
import {
  confirmPaymentAndActivate,
  createPaymentIntentAction,
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

interface CardData {
  id: string;
  display_code: string;
  status: string;
  price_cents: number;
  organization: {
    id: string;
    name: string;
  };
}

interface StripePaymentFormProps {
  card: CardData;
  onActivated: (result: ActivationResult) => void;
}

export function StripePaymentForm({
  card,
  onActivated,
}: StripePaymentFormProps) {
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
      const result = await createPaymentIntentAction({
        cardCode: card.display_code,
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
          `${createPaymentIntentErrorMessage(result.code)} (Reference: ${result.reference})`,
        );
      }
      setIsCreatingIntent(false);
    }

    initPaymentIntent();

    return () => {
      cancelled = true;
    };
  }, [card.display_code]);

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
        returnUrl={`${window.location.origin}/activate/${card.display_code}?payment=success`}
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
          const res = await confirmPaymentAndActivate({
            cardCode: card.display_code,
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
        onActivated={(result) =>
          onActivated({
            ...result,
            cardCode: result.cardCode || card.display_code,
          })
        }
      />
    </Elements>
  );
}
