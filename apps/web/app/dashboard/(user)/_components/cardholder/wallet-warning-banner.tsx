'use client';

import { useTransition } from 'react';

import Image from 'next/image';

import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { If } from '@kit/ui/if';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';
import { Trans } from '@kit/ui/trans';

import type { ClientPlatform } from '~/activate/_lib/detect-platform';
import { getGoogleWalletSaveUrl } from '~/activate/_lib/server/wallet.actions';
import { walletErrorMessage } from '~/activate/_lib/wallet-errors';

import { markCardholderWalletAdded } from '../../_lib/server/wallet-tracking.actions';

interface WalletWarningBannerProps {
  cardCode: string;
  platform: ClientPlatform;
}

export function WalletWarningBanner({
  cardCode,
  platform,
}: WalletWarningBannerProps) {
  const [isPending, startTransition] = useTransition();

  const showApple = platform === 'desktop' || platform === 'ios';
  const showGoogle = platform === 'desktop' || platform === 'android';

  const handleAppleClick = () => {
    // Fire-and-forget — the anchor navigates the browser to download the
    // .pkpass file in parallel.
    void markCardholderWalletAdded({ platform: 'apple' });
  };

  const handleGoogleClick = () => {
    startTransition(async () => {
      const result = await getGoogleWalletSaveUrl({ cardCode });

      if (result.success) {
        void markCardholderWalletAdded({ platform: 'google' });
        window.location.href = result.url;
        return;
      }

      toast.error(walletErrorMessage(result.code), {
        description: `Reference: ${result.reference}`,
      });
    });
  };

  return (
    <Alert
      variant="destructive"
      data-test="cardholder-wallet-warning-banner"
      className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />

      <div className="flex-1 pl-7 md:pl-0">
        <AlertTitle>
          <Trans i18nKey="common:walletWarning.title" />
        </AlertTitle>

        <AlertDescription>
          <Trans i18nKey="common:walletWarning.description" />
        </AlertDescription>
      </div>

      <div className="flex shrink-0 flex-row items-center gap-3 pl-7 md:pl-0">
        <If condition={showApple}>
          <a
            href={`/api/wallet/apple/${encodeURIComponent(cardCode)}`}
            onClick={handleAppleClick}
            aria-label="Add to Apple Wallet"
            data-test="wallet-banner-apple-button"
            className="transition-opacity hover:opacity-90"
          >
            <Image
              src="/wallet/add-to-apple-wallet.svg"
              alt="Add to Apple Wallet"
              width={158}
              height={50}
              priority
            />
            
          </a>
        </If>

        <If condition={showGoogle}>
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={isPending}
            aria-label="Add to Google Wallet"
            data-test="wallet-banner-google-button"
            className="transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <If
              condition={isPending}
              fallback={
                <Image
                  src="/wallet/add-to-google-wallet.svg"
                  alt="Add to Google Wallet"
                  width={199}
                  height={55}
                  priority
                />
              }
            >
              <div className="flex h-[55px] w-[199px] items-center justify-center gap-2 rounded-full bg-black text-white">
                <Spinner className="h-4 w-4" />
                <span className="text-sm">Adding…</span>
              </div>
            </If>
          </button>
        </If>
      </div>
    </Alert>
  );
}
