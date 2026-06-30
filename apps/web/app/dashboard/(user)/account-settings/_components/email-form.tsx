'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useUpdateUser } from '@kit/supabase/hooks/use-update-user-mutation';
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

import pathsConfig from '~/config/paths.config';

const EmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type EmailFormData = z.infer<typeof EmailSchema>;

interface EmailFormProps {
  email: string | null;
}

export function EmailForm({ email }: EmailFormProps) {
  const { t } = useTranslation('account');
  const updateUserMutation = useUpdateUser();

  const form = useForm<EmailFormData>({
    resolver: zodResolver(EmailSchema),
    defaultValues: {
      email: email ?? '',
    },
  });

  const onSubmit = async (data: EmailFormData) => {
    if (data.email === email) {
      toast.error(t('emailNotChanged'));
      return;
    }

    const redirectTo = new URL(
      pathsConfig.auth.callback + `?next=/dashboard/account-settings`,
      window.location.origin,
    ).toString();

    const promise = updateUserMutation.mutateAsync({
      email: data.email,
      redirectTo,
    });

    toast.promise(promise, {
      loading: t('updateEmailLoading'),
      success: t('updateEmailSuccess'),
      error: t('updateEmailError'),
    });
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-1">
        <h3 className="text-base font-medium">
          <Trans i18nKey="account:emailLabel" />
        </h3>
        <p className="text-muted-foreground text-sm">
          <Trans i18nKey="account:updateEmailCardDescription" />
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans i18nKey="account:emailLabel" />
                </FormLabel>
                <FormControl>
                  <Input
                    data-test="email-input"
                    type="email"
                    placeholder={t('emailLabel')}
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
              disabled={updateUserMutation.isPending}
              data-test="save-email-button"
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
