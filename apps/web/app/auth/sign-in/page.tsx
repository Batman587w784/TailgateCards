import Link from 'next/link';

import { Heading } from '@kit/ui/heading';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { AuthRedirectHandler } from './_components/auth-redirect-handler';
import { TailgateSignInForm } from './_components/tailgate-sign-in-form';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signIn'),
  };
};

async function SignInPage() {
  return (
    <>
      <AuthRedirectHandler />

      <div className="flex flex-col items-center gap-2">
        <Heading level={4} className="tracking-tight">
          Get started!
        </Heading>

        <p className="text-muted-foreground text-center text-sm">
          Log in to access your dashboard and continue where you left off....
        </p>
      </div>

      <TailgateSignInForm />

      <div className="text-center text-sm">
        <span className="text-muted-foreground">
          Don&apos;t have an account yet?{' '}
        </span>
        <Link
          href="/contact"
          className="text-brand font-normal hover:underline"
        >
          Contact Us
        </Link>
      </div>
    </>
  );
}

export default withI18n(SignInPage);
