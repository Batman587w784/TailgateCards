import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TailgatePasswordResetFlow } from './_components/tailgate-password-reset-flow';

export const generateMetadata = async () => {
  const { t } = await createI18nServerInstance();

  return {
    title: t('auth:passwordResetLabel'),
  };
};

function PasswordResetPage() {
  return <TailgatePasswordResetFlow />;
}

export default withI18n(PasswordResetPage);
