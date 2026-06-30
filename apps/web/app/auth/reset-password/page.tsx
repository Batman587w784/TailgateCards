import { Suspense } from 'react';

import { Spinner } from '@kit/ui/spinner';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { ResetPasswordForm } from './_components/reset-password-form';

export const generateMetadata = async () => {
  const { t } = await createI18nServerInstance();

  return {
    title: t('auth:passwordResetLabel'),
  };
};

function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

export default withI18n(ResetPasswordPage);
