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
  PhoneFormData,
  PhoneSchema,
} from '../_lib/schemas/account-settings.schema';
import { updatePhoneAction } from '../_lib/server/account-settings-actions';

interface PhoneFormProps {
  phone: string;
}

export function PhoneForm({ phone }: PhoneFormProps) {
  const { t } = useTranslation('account');
  const [isPending, startTransition] = useTransition();

  const form = useForm<PhoneFormData>({
    resolver: zodResolver(PhoneSchema),
    defaultValues: {
      phone,
    },
  });

  const onSubmit = (data: PhoneFormData) => {
    startTransition(async () => {
      const promise = updatePhoneAction(data);

      toast.promise(promise, {
        loading: t('updateProfileLoading'),
        success: t('updateProfileSuccess'),
        error: t('updateProfileError'),
      });
    });
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-1">
        <h3 className="text-base font-medium">
          <Trans i18nKey="account:phone" />
        </h3>
        <p className="text-muted-foreground text-sm">
          <Trans i18nKey="account:phoneDescription" />
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans i18nKey="account:phone" />
                </FormLabel>
                <FormControl>
                  <Input
                    data-test="phone-input"
                    type="tel"
                    placeholder={t('phone')}
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
              data-test="save-phone-button"
              className="bg-brand"
            >
              <Trans i18nKey="common:save" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
