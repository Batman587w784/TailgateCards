'use client';

import { useTransition } from 'react';

import Link from 'next/link';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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

import { confirmActivationErrorMessage } from '../_lib/activation-errors';
import { claimDigitalCard } from '../_lib/server/card-activation.actions';
import type { DiscountPreview } from '../_lib/server/card-activation.loader';
import { CardInfoDisplay } from './card-info-display';

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

const ClaimFormSchema = z.object({
  email: z.string().email('Enter a valid email'),
  country: z.string().min(2, 'Required'),
  postalCode: z.string().min(1, 'Required'),
  cardholderName: z
    .string()
    .trim()
    .min(2, 'Please enter the full name on the card')
    .max(80, 'Cardholder name must be less than 80 characters'),
  termsAccepted: z
    .boolean()
    .refine((v) => v === true, { message: 'You must accept the terms' }),
  marketingOptIn: z.boolean(),
});

type ClaimFormData = z.infer<typeof ClaimFormSchema>;

interface ActivationResult {
  accountId: string;
  cardCode: string;
  email: string;
}

interface DigitalClaimFormProps {
  claimToken: string;
  card: {
    display_code: string;
    organization: {
      name: string;
      picture_url?: string | null;
    };
  };
  defaultEmail?: string | null;
  discounts: DiscountPreview[];
  onActivated: (result: ActivationResult) => void;
}

export function DigitalClaimForm({
  claimToken,
  card,
  defaultEmail,
  discounts,
  onActivated,
}: DigitalClaimFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ClaimFormData>({
    resolver: zodResolver(ClaimFormSchema),
    defaultValues: {
      email: defaultEmail ?? '',
      country: 'US',
      postalCode: '',
      cardholderName: '',
      termsAccepted: false,
      marketingOptIn: false,
    },
  });

  const onSubmit = (data: ClaimFormData) => {
    startTransition(async () => {
      const result = await claimDigitalCard({
        claimToken,
        ...data,
      });

      if (
        result.success &&
        result.accountId &&
        result.email &&
        result.cardCode
      ) {
        onActivated({
          accountId: result.accountId,
          cardCode: result.cardCode,
          email: result.email,
        });
      } else if (!result.success) {
        form.setError('root', {
          type: 'server',
          message: `${confirmActivationErrorMessage(result.code)} (Reference: ${result.reference})`,
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-green-600">
          Payment received!
        </h3>
        <p className="text-sm text-green-500">
          Tell us a little about you to activate your card.
        </p>
      </div>

      <CardInfoDisplay card={card} discounts={discounts} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <If condition={form.formState.errors.root}>
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {form.formState.errors.root?.message}
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
                    data-test="claim-email-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="country"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-test="claim-country-select">
                        <SelectValue />
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
                  <FormLabel>Postal code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="94110"
                      autoComplete="postal-code"
                      data-test="claim-postal-input"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
                    data-test="claim-cardholder-name-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="termsAccepted"
            control={form.control}
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-test="claim-terms-checkbox"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-xs font-normal">
                    I accept the Tailgate terms of service.
                  </FormLabel>
                  <p className="text-muted-foreground text-xs">
                    See our{' '}
                    <Link
                      href="/terms-of-service"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline underline-offset-2"
                      data-test="claim-terms-of-service-link"
                    >
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline underline-offset-2"
                      data-test="claim-privacy-policy-link"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <FormField
            name="marketingOptIn"
            control={form.control}
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-test="claim-marketing-checkbox"
                  />
                </FormControl>
                <FormLabel className="text-xs font-normal">
                  Send me occasional updates and offers (optional).
                </FormLabel>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="bg-brand text-brand-foreground hover:bg-brand/90 w-full"
            data-test="claim-submit-button"
          >
            <If condition={isPending} fallback="Activate my card">
              <Spinner className="mr-2 h-4 w-4" />
              Activating…
            </If>
          </Button>
        </form>
      </Form>
    </div>
  );
}
