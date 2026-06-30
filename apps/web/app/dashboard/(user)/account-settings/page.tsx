import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import authConfig from '~/config/auth.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { DashboardPageHeader } from '../_components/dashboard-page-header';
import { HomeLayoutPageHeader } from '../_components/home-page-header';
import { getUserMerchantId, isMerchant } from '../_lib/server/role-guards';
import { PasscodeGuard } from '../merchant/_components/passcode-guard';
// local imports
import { AccountSettingsContainer } from './_components/account-settings-container';
import { loadCardholderSettings } from './_lib/server/account-settings.loader';

async function getMerchantBusinessName(
  merchantId: string,
): Promise<string | null> {
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('merchant_profiles')
    .select('business_name')
    .eq('account_id', merchantId)
    .single();
  return data?.business_name ?? null;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('account:accountSettings');

  return {
    title,
  };
};

async function AccountSettingsPage() {
  const client = getSupabaseServerClient();
  const [settings, userIsMerchant] = await Promise.all([
    loadCardholderSettings(),
    isMerchant(client),
  ]);

  // Get merchant info if user is a merchant
  let merchantName: string | null = null;
  if (userIsMerchant) {
    const merchantId = await getUserMerchantId();
    if (merchantId) {
      merchantName = await getMerchantBusinessName(merchantId);
    }
  }

  const content = (
    <div className="rounded-lg lg:m-4 lg:border">
      <HomeLayoutPageHeader
        title={<Trans i18nKey="account:accountSettings" />}
        description="Account Settings"
      />

      <PageBody>
        <div className="flex flex-col gap-6 pt-4 md:pt-0">
          <DashboardPageHeader
            subtitle={userIsMerchant && merchantName ? merchantName : undefined}
            title={
              <Trans
                i18nKey="account:accountSettings"
                defaults="Account Settings"
              />
            }
          />

          <AccountSettingsContainer
            firstName={settings.firstName}
            lastName={settings.lastName}
            email={settings.email}
            phone={settings.phone}
            enablePasswordUpdate={authConfig.providers.password}
          />
        </div>
      </PageBody>
    </div>
  );

  if (userIsMerchant) {
    return (
      <PasscodeGuard description="Enter your passcode to access account settings.">
        {content}
      </PasscodeGuard>
    );
  }

  return content;
}

export default withI18n(AccountSettingsPage);
