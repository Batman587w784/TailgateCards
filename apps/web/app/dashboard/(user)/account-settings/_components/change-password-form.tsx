'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

import {
  ChangePasswordFormData,
  ChangePasswordSchema,
} from '../_lib/schemas/account-settings.schema';
import { changePasswordAction } from '../_lib/server/account-settings-actions';

export function ChangePasswordForm() {
  const { t } = useTranslation('account');
  const [isPending, startTransition] = useTransition();

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    startTransition(async () => {
      try {
        await changePasswordAction(data);
        toast.success(t('updatePasswordSuccess'));
        form.reset();
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Current password is incorrect') {
            toast.error(t('currentPasswordIncorrect'));
          } else {
            toast.error(t('updatePasswordError'));
          }
        } else {
          toast.error(t('updatePasswordError'));
        }
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
      <div className="flex flex-col space-y-1 lg:w-1/3">
        <h3 className="text-base font-medium">
          <Trans i18nKey="account:changePassword" />
        </h3>
        <p className="text-muted-foreground text-sm">
          <Trans i18nKey="account:changePasswordDescription" />
        </p>
      </div>

      <div className="flex-1">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey="account:verifyCurrentPassword" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-test="current-password-input"
                      type="password"
                      placeholder={t('currentPassword')}
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey="account:newPassword" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-test="new-password-input"
                      type="password"
                      placeholder={t('newPassword')}
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey="account:confirmPassword" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-test="confirm-password-input"
                      type="password"
                      placeholder={t('repeatPassword')}
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isPending}
                data-test="save-password-button"
                className="bg-brand"
              >
                <Trans i18nKey="common:save" />
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
