'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useRevalidatePersonalAccountDataQuery } from '@kit/accounts/hooks/use-personal-account-data';
import { useUser } from '@kit/supabase/hooks/use-user';
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
  BasicInfoFormData,
  BasicInfoSchema,
} from '../_lib/schemas/account-settings.schema';
import { updateBasicInfoAction } from '../_lib/server/account-settings-actions';

interface BasicInfoFormProps {
  firstName: string;
  lastName: string;
}

export function BasicInfoForm({ firstName, lastName }: BasicInfoFormProps) {
  const { t } = useTranslation('account');
  const [isPending, startTransition] = useTransition();
  const user = useUser();
  const revalidatePersonalAccount = useRevalidatePersonalAccountDataQuery();

  const form = useForm<BasicInfoFormData>({
    resolver: zodResolver(BasicInfoSchema),
    defaultValues: {
      firstName,
      lastName,
    },
  });

  const onSubmit = (data: BasicInfoFormData) => {
    startTransition(async () => {
      const promise = updateBasicInfoAction(data).then((result) => {
        // Invalidate React Query cache for personal account data after successful update
        if (user.data?.id) {
          revalidatePersonalAccount(user.data.id);
        }
        return result;
      });

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
          <Trans i18nKey="account:basicInfo" />
        </h3>
        <p className="text-muted-foreground text-sm">
          <Trans i18nKey="account:basicInfoDescription" />
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey="account:firstName" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-test="first-name-input"
                      placeholder={t('firstName')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey="account:lastName" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-test="last-name-input"
                      placeholder={t('lastName')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isPending}
              data-test="save-basic-info-button"
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
