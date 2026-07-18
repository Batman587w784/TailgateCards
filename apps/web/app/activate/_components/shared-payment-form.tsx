'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { PaymentElement, useElements, useStripe } from '@kit/stripe/components';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Spinner } from '@kit/ui/spinner';

import {
  type ActivateCardFormData,
  ActivateCardSchema,
} from '../_lib/schemas/card-activation.schema';

interface AttachContactResponse {
  success: boolean;
  message?: string;
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'MX', name: 'Mexico' },
];

export interface PriceBreakdown {
  cardCents: number;
  feeCents: number;
  taxCents: number;
  totalCents: number;
}

export interface ConfirmPaymentInput {
  paymentIntentId: string;
  email: string;
  country: string;
  postalCode: string;
  cardholderName: string;
  termsAccepted: boolean;
  marketingOptIn: boolean;
}

/** An extra card from a multi-card order the buyer can gift/share. */
export interface GiftCard {
  claimToken: string;
  cardCode: string;
}

export interface ActivationResult {
  accountId: string;
  cardCode: string;
  email: string;
  /** How many cards were purchased in this order (1 for a single card). */
  quantity?: number;
  /** The extra (unclaimed) cards from a multi-card order, to share. */
  giftCards?: GiftCard[];
}

interface ConfirmResponse {
  success: boolean;
  /** Already-resolved, user-facing message (incl. support reference) on failure. */
  message?: string;
  accountId?: string;
  cardCode?: string;
  email?: string;
  quantity?: number;
  giftCards?: GiftCard[];
}

interface ValidateEmailResponse {
  available: boolean;
  /** Already-resolved, user-facing message when the email is unavailable. */
  message?: string;
}

interface SharedPaymentFormProps {
  paymentIntentId: string;
  priceBreakdown: PriceBreakdown;
  returnUrl: string;
  validateEmail: (email: string) => Promise<ValidateEmailResponse>;
  onConfirm: (input: ConfirmPaymentInput) => Promise<ConfirmResponse>;
  onActivated: (result: ActivationResult) => void;
  /** When true, collect a (required) buyer phone number. */
  collectPhone?: boolean;
  /**
   * Persists buyer contact onto the PaymentIntent just before confirmation.
   * Provided by the digital purchase flow; omitted for physical cards.
   */
  attachContact?: (input: {
    paymentIntentId: string;
    email: string;
    phone?: string;
  }) => Promise<AttachContactResponse>;
}

export function SharedPaymentForm({
  paymentIntentId,
  priceBreakdown,
  returnUrl,
  validateEmail,
  onConfirm,
  onActivated,
  collectPhone = false,
  attachContact,
}: SharedPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false);
  // Once Stripe has charged the buyer, we hold onto the form values so a
  // retry can re-run *only* the server activation. Re-confirming the same
  // PaymentIntent on Stripe would error with "PaymentIntent has already
  // succeeded" and trap the user with their money taken but no card.
  const [paidFormData, setPaidFormData] = useState<ActivateCardFormData | null>(
    null,
  );

  const form = useForm<ActivateCardFormData>({
    resolver: zodResolver(ActivateCardSchema),
    defaultValues: {
      email: '',
      country: 'US',
      postalCode: '',
      cardholderName: '',
      buyerPhone: '',
      termsAccepted: false,
      marketingOptIn: false,
    },
  });

  const finalize = (data: ActivateCardFormData) => {
    startTransition(async () => {
      const result = await onConfirm({
        paymentIntentId,
        email: data.email,
        country: data.country,
        postalCode: data.postalCode,
        cardholderName: data.cardholderName,
        termsAccepted: data.termsAccepted,
        marketingOptIn: data.marketingOptIn,
      });

      setIsProcessing(false);

      if (result.success && result.accountId && result.email) {
        onActivated({
          accountId: result.accountId,
          cardCode: result.cardCode ?? '',
          email: result.email,
          quantity: result.quantity,
          giftCards: result.giftCards,
        });
      } else {
        form.setError('root', {
          type: 'server',
          message: result.message ?? 'Failed to activate card',
        });
      }
    });
  };

  const onSubmit = async (data: ActivateCardFormData) => {
    // Payment already went through on a previous submit — retry finalize only.
    if (paidFormData) {
      setIsProcessing(true);
      form.clearErrors('root');
      finalize(paidFormData);
      return;
    }

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    if (collectPhone && !data.buyerPhone?.trim()) {
      setIsProcessing(false);
      form.setError('buyerPhone', {
        type: 'server',
        message: 'Phone number is required',
      });
      return;
    }

    const emailValidation = await validateEmail(data.email);

    if (!emailValidation.available) {
      setIsProcessing(false);
      form.setError('email', {
        type: 'server',
        message:
          emailValidation.message ??
          'This email is already associated with a card.',
      });
      return;
    }

    // Persist buyer contact to the PaymentIntent BEFORE confirming, so the phone
    // and receipt_email survive to the webhook even if the buyer never finishes
    // inline activation.
    if (attachContact) {
      const attachResult = await attachContact({
        paymentIntentId,
        email: data.email,
        phone: data.buyerPhone?.trim() || undefined,
      });

      if (!attachResult.success) {
        setIsProcessing(false);
        form.setError('root', {
          type: 'server',
          message:
            attachResult.message ?? 'Could not save your contact details',
        });
        return;
      }
    }

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        payment_method_data: {
          billing_details: {
            name: data.cardholderName,
            email: data.email,
            address: {
              country: data.country,
              postal_code: data.postalCode,
            },
          },
        },
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      setIsProcessing(false);
      form.setError('root', {
        type: 'server',
        message: stripeError.message ?? 'Payment failed',
      });
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      // Lock in retry state before kicking off finalize: if the await below
      // ever throws or the user reloads, the next submit will skip Stripe.
      setPaidFormData(data);
      finalize(data);
    } else {
      setIsProcessing(false);
      form.setError('root', {
        type: 'server',
        message: 'Payment was not completed',
      });
    }
  };

  const isSubmitting = isPending || isProcessing;
  const isRetry = paidFormData !== null;

  const formatCents = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div
          className="bg-sidebar rounded-lg border p-4"
          data-test="card-price-display"
        >
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Card amount</span>
              <span data-test="card-amount">
                {formatCents(priceBreakdown.cardCents)}
              </span>
            </div>
            {priceBreakdown.feeCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction fee</span>
                <span data-test="card-fee">
                  {formatCents(priceBreakdown.feeCents)}
                </span>
              </div>
            )}
            {priceBreakdown.taxCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span data-test="card-tax">
                  {formatCents(priceBreakdown.taxCents)}
                </span>
              </div>
            )}
            <div className="border-border flex justify-between border-t pt-2">
              <span className="font-medium">Total</span>
              <span
                className="text-primary text-lg font-bold"
                data-test="card-total"
              >
                {formatCents(priceBreakdown.totalCents)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-sidebar rounded-lg border p-4">
          <div className="flex items-start space-x-3">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Wallet connection required</p>
              <p className="text-muted-foreground text-sm">
                You&apos;ll need to connect your card to Apple Wallet or Google
                Wallet before you can use it.
              </p>
            </div>
          </div>
        </div>

        <If condition={form.formState.errors.root}>
          <Alert variant="destructive">
            <AlertTitle>
              {isRetry ? 'Activation incomplete' : 'Payment Failed'}
            </AlertTitle>
            <AlertDescription>
              {form.formState.errors.root?.message}
              {isRetry ? (
                <span className="mt-2 block text-xs">
                  Your payment went through. Click retry to finish activating
                  your card — you won&apos;t be charged again.
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        </If>

        <FormField
          name="email"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  data-test="email-input"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {collectPhone && (
          <FormField
            name="buyerPhone"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    autoComplete="tel"
                    data-test="phone-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="space-y-2">
          <FormLabel>Card information</FormLabel>
          <div className="rounded-md border bg-white p-3">
            <PaymentElement
              options={{
                fields: {
                  billingDetails: {
                    name: 'never',
                    email: 'never',
                    address: {
                      country: 'never',
                      postalCode: 'never',
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <FormField
          name="country"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country or region</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-test="country-select">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="postalCode"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  placeholder="ZIP"
                  autoComplete="postal-code"
                  data-test="postal-code-input"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="cardholderName"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cardholder name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Full name on card"
                  autoComplete="cc-name"
                  data-test="cardholder-name-input"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <FormField
            name="termsAccepted"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-test="terms-checkbox"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer font-medium">
                      I agree to the Terms
                    </FormLabel>
                    <p className="text-muted-foreground text-sm">
                      I accept the{' '}
                      <Link
                        href="/terms-of-service"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 underline underline-offset-2"
                        data-test="terms-of-service-link"
                      >
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link
                        href="/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 underline underline-offset-2"
                        data-test="privacy-policy-link"
                      >
                        Privacy Policy
                      </Link>
                      , and allow processing of my personal information.
                    </p>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="marketingOptIn"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-test="marketing-checkbox"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer font-medium">
                      Hear about new card drops
                    </FormLabel>
                    <p className="text-muted-foreground text-sm">
                      Receive alerts for deals and rewards
                    </p>
                  </div>
                </div>
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          className="bg-brand text-brand-foreground hover:bg-brand/90 w-full"
          size="lg"
          disabled={isSubmitting || !stripe || !elements}
          data-test={
            isRetry ? 'retry-activation-button' : 'activate-card-button'
          }
        >
          <If
            condition={isSubmitting}
            fallback={isRetry ? 'Retry activation' : 'Activate'}
          >
            <Spinner className="mr-2 h-4 w-4" />
            Processing...
          </If>
        </Button>

        <p className="text-muted-foreground text-center text-xs">
          By clicking Activate, you agree to the Terms and Privacy Policy.
        </p>
      </form>
    </Form>
  );
}
