'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Hash, ScanLine } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardFooter } from '@kit/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Heading } from '@kit/ui/heading';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Spinner } from '@kit/ui/spinner';

import { verifyCardErrorMessage } from '../../_lib/activation-errors';
import {
  type VerifyCardFormData,
  VerifyCardSchema,
} from '../../_lib/schemas/card-activation.schema';
import { verifyCardCode } from '../../_lib/server/card-activation.actions';

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

interface StepVerificationProps {
  onVerified: (card: CardData) => void;
}

export function StepVerification({ onVerified }: StepVerificationProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<VerifyCardFormData>({
    resolver: zodResolver(VerifyCardSchema),
    defaultValues: { cardCode: '' },
  });

  const onSubmit = (data: VerifyCardFormData) => {
    startTransition(async () => {
      const result = await verifyCardCode(data);

      if (result.success && result.card) {
        onVerified(result.card as CardData);
      } else if (!result.success) {
        form.setError('cardCode', {
          type: 'server',
          message: `${verifyCardErrorMessage(result.code)} (Reference: ${result.reference})`,
        });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="flex flex-col">
        <CardContent className="flex flex-1 flex-col items-center gap-3 pt-6 text-center">
          <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
            <ScanLine className="text-primary h-6 w-6" />
          </div>
          <div>
            <Heading level={4} className="mb-1">
              Quick Verification
            </Heading>
            <p className="text-muted-foreground text-sm">
              Scan your QR code or use digital verification to link your account
            </p>
          </div>
        </CardContent>
        <CardFooter className="mt-auto border-t pt-6">
          <Button
            size="lg"
            className="bg-brand text-brand-foreground hover:bg-brand/90 w-full"
            data-test="qr-scan-button"
          >
            Start Verification
          </Button>
        </CardFooter>
      </Card>

      <Card className="flex flex-col">
        <CardContent className="flex flex-1 flex-col items-center gap-3 pt-6 text-center">
          <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
            <Hash className="text-primary h-6 w-6" />
          </div>
          <div>
            <Heading level={4} className="mb-1">
              Enter Access Code
            </Heading>
            <p className="text-muted-foreground text-sm">
              Type the unique access code provided by your organization
            </p>
          </div>
        </CardContent>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <If
                  condition={form.formState.errors.cardCode?.type === 'server'}
                >
                  <Alert variant="destructive">
                    <AlertTitle>Verification Failed</AlertTitle>
                    <AlertDescription>
                      {form.formState.errors.cardCode?.message}
                    </AlertDescription>
                  </Alert>
                </If>

                <FormField
                  name="cardCode"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="text-left">
                      <FormLabel>Access code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="TG-XXXX-XXXXXXXX"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase())
                          }
                          className="font-mono uppercase"
                          autoComplete="off"
                          data-test="card-code-input"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>

            <CardFooter className="mt-auto border-t pt-6">
              <Button
                type="submit"
                className="bg-brand text-brand-foreground hover:bg-brand/90 w-full"
                size="lg"
                disabled={isPending}
                data-test="verify-card-button"
              >
                <If condition={isPending} fallback="Start Verification">
                  <Spinner className="mr-2 h-4 w-4" />
                  Verifying...
                </If>
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
