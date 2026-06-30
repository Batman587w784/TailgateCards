'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { PasswordInput } from '@kit/auth/components/password-input';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { If } from '@kit/ui/if';
import { Spinner } from '@kit/ui/spinner';
import { Trans } from '@kit/ui/trans';

import {
  type SetupPasswordFormData,
  SetupPasswordSchema,
} from '../_lib/schemas/setup-password.schema';
import { setInvitedUserPassword } from '../_lib/server/setup-password-server-actions';

interface SetupPasswordFormProps {
  inviteToken: string;
  email: string;
}

export function SetupPasswordForm({
  inviteToken,
  email,
}: SetupPasswordFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = useSupabase();

  const form = useForm<SetupPasswordFormData>({
    resolver: zodResolver(SetupPasswordSchema),
    defaultValues: {
      password: '',
      repeatPassword: '',
    },
  });

  const onSubmit = (data: SetupPasswordFormData) => {
    startTransition(async () => {
      const result = await setInvitedUserPassword({
        inviteToken,
        password: data.password,
      });

      if (result.success) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: data.password,
        });

        if (signInError) {
          form.setError('root', {
            type: 'server',
            message: signInError.message,
          });

          return;
        }

        router.push(`/join?invite_token=${encodeURIComponent(inviteToken)}`);
      } else {
        form.setError('root', {
          type: 'server',
          message: result.error ?? 'Failed to set password',
        });
      }
    });
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-5">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-muted-foreground text-sm">
          <Trans i18nKey={'auth:setupPasswordDescription'} />
        </p>
      </div>

      <div className="bg-muted rounded-lg border px-4 py-3">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Email</span>
          <span className="font-medium">{email}</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <If condition={form.formState.errors.root}>
            <Alert variant="destructive">
              <AlertTitle>
                <Trans i18nKey={'auth:errorAlertHeading'} />
              </AlertTitle>
              <AlertDescription>
                {form.formState.errors.root?.message}
              </AlertDescription>
            </Alert>
          </If>

          <FormField
            name="password"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans i18nKey={'auth:passwordCreateLabel'} />
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    data-test="password-input"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  <Trans i18nKey={'auth:passwordHint'} />
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="repeatPassword"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans i18nKey={'auth:repeatPassword'} />
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    data-test="repeat-password-input"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  <Trans i18nKey={'auth:repeatPasswordHint'} />
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isPending}
            data-test="setup-password-submit"
          >
            <If
              condition={isPending}
              fallback={<Trans i18nKey={'auth:setupPasswordSubmit'} />}
            >
              <Spinner className="mr-2 h-4 w-4" />
              <Trans i18nKey={'auth:setupPasswordSettingUp'} />
            </If>
          </Button>
        </form>
      </Form>
    </div>
  );
}
