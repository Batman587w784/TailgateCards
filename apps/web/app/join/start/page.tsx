import { withI18n } from '~/lib/i18n/with-i18n';

import { JoinStartFlow } from './_components/join-start-flow';

export const metadata = {
  title: 'Get Started',
};

/**
 * M1 / T6 — public self-signup entry (the T0 "Get Started" target).
 * Campus -> Chapter -> phone -> OTP -> register_member. Additive: does not touch
 * the existing email+password login.
 */
function JoinStartPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <JoinStartFlow />
    </div>
  );
}

export default withI18n(JoinStartPage);
