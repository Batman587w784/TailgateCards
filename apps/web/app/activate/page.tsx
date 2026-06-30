import type { Metadata } from 'next';

import { headers } from 'next/headers';

import { withI18n } from '~/lib/i18n/with-i18n';

import { ActivateCardFlow } from './_components/activate-card-flow';
import { detectPlatform } from './_lib/detect-platform';

export const metadata: Metadata = {
  title: 'Activate Your Tailgate Card',
  description:
    'Activate your Tailgate NFC card to start saving at local businesses.',
};

async function ActivatePage() {
  // Manual code entry flow - starts from Step 0 (Verification)
  // QR scanned URLs go to /activate/[code] route instead
  const userAgent = (await headers()).get('user-agent');
  const platform = detectPlatform(userAgent);

  return (
    <ActivateCardFlow
      cardData={{ found: false, card: null }}
      initialStep={0}
      discounts={[]}
      platform={platform}
    />
  );
}

export default withI18n(ActivatePage);
