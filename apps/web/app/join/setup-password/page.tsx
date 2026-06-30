import { notFound } from 'next/navigation';

import { AuthLayoutShell } from '@kit/auth/shared';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import { AppLogo } from '~/components/app-logo';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { SetupPasswordForm } from '../_components/setup-password-form';

interface SetupPasswordPageProps {
  searchParams: Promise<{
    invite_token?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:setupPassword'),
  };
};

async function SetupPasswordPage(props: SetupPasswordPageProps) {
  const searchParams = await props.searchParams;
  const inviteToken = searchParams.invite_token;

  if (!inviteToken) {
    notFound();
  }

  const adminClient = getSupabaseServerAdminClient();

  // Validate invitation exists and is not expired
  const { data: invitation, error } = await adminClient
    .from('invitations')
    .select('email')
    .eq('invite_token', inviteToken)
    .gte('expires_at', new Date().toISOString())
    .single();

  if (error || !invitation) {
    return (
      <AuthLayoutShell Logo={AppLogo}>
        <div className="flex flex-col items-center space-y-4">
          <Heading level={6}>
            <Trans i18nKey={'teams:inviteNotFoundOrExpired'} />
          </Heading>

          <p className="text-muted-foreground text-sm">
            <Trans i18nKey={'teams:inviteNotFoundOrExpiredDescription'} />
          </p>
        </div>
      </AuthLayoutShell>
    );
  }

  return (
    <AuthLayoutShell Logo={AppLogo}>
      <div className="flex w-full flex-col items-center space-y-6">
        <Heading level={4} className="text-center">
          <Trans i18nKey={'auth:setupPassword'} />
        </Heading>

        <SetupPasswordForm inviteToken={inviteToken} email={invitation.email} />
      </div>
    </AuthLayoutShell>
  );
}

export default withI18n(SetupPasswordPage);
