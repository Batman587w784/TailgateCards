'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
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
import { Spinner } from '@kit/ui/spinner';

import { TailgateLogo } from '~/components/tailgate-logo';

import {
  type VerifyPasscodeInput,
  VerifyPasscodeSchema,
} from '../../entities/_lib/schemas/passcode.schema';
import { verifyPasscodeAction } from '../_lib/server/passcode-server-actions';

interface PasscodeVerificationFormProps {
  description?: string;
}

export function PasscodeVerificationForm({
  description = 'Enter your passcode to access this page.',
}: PasscodeVerificationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<VerifyPasscodeInput>({
    resolver: zodResolver(VerifyPasscodeSchema),
    defaultValues: {
      passcode: '',
    },
  });

  const handleSubmit = (data: VerifyPasscodeInput) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await verifyPasscodeAction(data);

        if (result.success) {
          router.refresh();
        } else {
          setError(result.error ?? 'Invalid passcode');
          form.reset();
        }
      } catch {
        setError('An unexpected error occurred');
        form.reset();
      }
    });
  };

  return (
    <Card className="w-full max-w-[400px] shadow-lg">
      <CardHeader className="items-center text-center">
        <div className="mb-2">
          <TailgateLogo />
        </div>
        <CardTitle className="text-xl font-semibold">Enter Passcode</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-4"
          >
            <If condition={Boolean(error)}>
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </If>

            <FormField
              name="passcode"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passcode</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      maxLength={4}
                      placeholder="Enter passcode"
                      className="text-center text-lg tracking-widest uppercase placeholder:normal-case"
                      autoComplete="off"
                      autoFocus
                      disabled={isPending}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                      data-test="passcode-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="bg-brand w-full"
              disabled={isPending}
              data-test="verify-passcode-button"
            >
              {isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
