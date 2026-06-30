'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ErrorBoundary } from '@kit/monitoring/components';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
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
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Trans } from '@kit/ui/trans';

import {
  DeleteAccountFormData,
  DeleteAccountSchema,
} from '../_lib/schemas/account-settings.schema';
import { deleteCardholderAccountAction } from '../_lib/server/account-settings-actions';

export function DeleteAccountSection() {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>
          <Trans i18nKey="account:deleteAccount" />
        </CardTitle>
        <CardDescription>
          <Trans i18nKey="account:deleteAccountCardDescription" />
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="bg-destructive/10 flex flex-col gap-3 rounded-md p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-destructive text-sm font-medium">
            <Trans i18nKey="account:deleteAccountCannotUndo" />
          </span>

          <DeleteAccountModal />
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteAccountModal() {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button data-test="delete-account-button" variant="destructive">
          <Trans i18nKey="account:deleteAccount" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <ErrorBoundary fallback={<DeleteAccountErrorContainer />}>
          <DeleteAccountForm />
        </ErrorBoundary>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteAccountForm() {
  const { t } = useTranslation('account');
  const [isPending, startTransition] = useTransition();

  const form = useForm<DeleteAccountFormData>({
    resolver: zodResolver(DeleteAccountSchema),
    mode: 'onChange',
    defaultValues: {
      confirmation: '' as 'DELETE',
    },
  });

  const isValid = form.watch('confirmation') === 'DELETE';

  const onSubmit = (data: DeleteAccountFormData) => {
    startTransition(async () => {
      await deleteCardholderAccountAction(data);
    });
  };

  return (
    <Form {...form}>
      <form
        data-test="delete-account-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col space-y-4"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans i18nKey="account:deleteAccount" />
          </AlertDialogTitle>
          <AlertDialogDescription className="flex flex-col space-y-2">
            <span>
              <Trans i18nKey="account:deleteAccountDialogDescription" />
            </span>
            <span>
              <Trans i18nKey="common:modalConfirmationQuestion" />
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <FormField
          control={form.control}
          name="confirmation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans i18nKey="account:deleteProfileConfirmationInputLabel" />
              </FormLabel>
              <FormControl>
                <Input
                  data-test="delete-confirmation-input"
                  placeholder={t('typeDeletePlaceholder')}
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans i18nKey="common:cancel" />
          </AlertDialogCancel>
          <Button
            data-test="confirm-delete-account-button"
            type="submit"
            disabled={isPending || !isValid}
            variant="destructive"
          >
            {isPending ? (
              <Trans i18nKey="account:deletingAccount" />
            ) : (
              <Trans i18nKey="account:deleteAccount" />
            )}
          </Button>
        </AlertDialogFooter>
      </form>
    </Form>
  );
}

function DeleteAccountErrorContainer() {
  return (
    <div className="flex flex-col gap-y-4">
      <Alert variant="destructive">
        <AlertTitle>
          <Trans i18nKey="account:deleteAccountErrorHeading" />
        </AlertTitle>

        <AlertDescription>
          <Trans i18nKey="common:genericError" />
        </AlertDescription>
      </Alert>

      <div>
        <AlertDialogCancel>
          <Trans i18nKey="common:cancel" />
        </AlertDialogCancel>
      </div>
    </div>
  );
}
