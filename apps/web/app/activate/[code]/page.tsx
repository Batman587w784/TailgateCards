import type { Metadata } from 'next';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { withI18n } from '~/lib/i18n/with-i18n';

import { ActivateCardFlow } from '../_components/activate-card-flow';
import { detectPlatform } from '../_lib/detect-platform';
import {
  loadCardByCode,
  loadDiscountsForOrganization,
} from '../_lib/server/card-activation.loader';

export const metadata: Metadata = {
  title: 'Activate Your Tailgate Card',
  description:
    'Activate your Tailgate NFC card to start saving at local businesses.',
};

interface PageProps {
  params: Promise<{
    code: string;
  }>;
  searchParams: Promise<{
    step?: string;
  }>;
}

async function ActivateWithCodePage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { step } = await searchParams;

  const cardData = await loadCardByCode(code);

  const wantsWallet = step === 'wallet';
  const isActivated = cardData.card?.status === 'activated';

  // Deep-link / reload of a wallet step for an already-activated card. We keep
  // the user on the wallet view (rather than bouncing them to sign-in) so the
  // "Add to Wallet" buttons stay reachable even after a failed wallet handoff.
  if (isActivated && wantsWallet && cardData.card?.display_code) {
    const discounts = await loadDiscountsForOrganization(
      cardData.card.organization.id,
    );
    const userAgent = (await headers()).get('user-agent');
    const platform = detectPlatform(userAgent);

    return (
      <ActivateCardFlow
        cardData={{
          ...cardData,
          activatedCard: {
            accountId: '',
            cardCode: cardData.card.display_code,
            email: '',
            temporaryPasswordSent: false,
          },
        }}
        initialStep={2}
        discounts={discounts}
        platform={platform}
      />
    );
  }

  // Activated without ?step=wallet — preserve existing behavior and route the
  // cardholder to sign-in.
  if (isActivated) {
    redirect('/auth/sign-in');
  }

  const discounts = cardData.card
    ? await loadDiscountsForOrganization(cardData.card.organization.id)
    : [];

  const userAgent = (await headers()).get('user-agent');
  const platform = detectPlatform(userAgent);

  // Start from Step 1 (Activation) since code is provided via QR
  return (
    <ActivateCardFlow
      cardData={cardData}
      initialStep={1}
      discounts={discounts}
      platform={platform}
    />
  );
}

export default withI18n(ActivateWithCodePage);
