'use client';

import { useState, useTransition } from 'react';

import Image from 'next/image';

import { Alert, AlertDescription } from '@kit/ui/alert';
import { If } from '@kit/ui/if';
import { Spinner } from '@kit/ui/spinner';

import type { ClientPlatform } from '../_lib/detect-platform';
import { getGoogleWalletSaveUrl } from '../_lib/server/wallet.actions';
import {
  type WalletErrorCode,
  walletErrorMessage,
} from '../_lib/wallet-errors';

interface SaveToWalletProps {
  cardCode: string;
  platform: ClientPlatform;
}

interface WalletError {
  message: string;
  reference: string | null;
}

const isWalletErrorCode = (value: unknown): value is WalletErrorCode =>
  value === 'WALLET_NOT_CONFIGURED' ||
  value === 'WALLET_GENERATION_FAILED' ||
  value === 'CARD_NOT_FOUND';

export function SaveToWallet({ cardCode, platform }: SaveToWalletProps) {
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [error, setError] = useState<WalletError | null>(null);

  const appleHref = `/api/wallet/apple/${encodeURIComponent(cardCode)}`;

  const handleGoogleClick = () => {
    setError(null);
    startGoogleTransition(async () => {
      const result = await getGoogleWalletSaveUrl({ cardCode });

      if (result.success) {
        window.open(result.url, '_blank', 'noopener,noreferrer');
        return;
      }

      setError({
        message: walletErrorMessage(result.code),
        reference: result.reference,
      });
    });
  };

  const handleAppleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Probe the endpoint before navigating so we can show inline errors instead
    // of dumping the user on a broken `.pkpass` URL. The actual download still
    // happens via the link's normal navigation if the probe succeeds.
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    setError(null);

    void (async () => {
      try {
        // GET (not HEAD) so we can read the typed `{ code, reference }` body the
        // route returns on failure. On success the response is the binary pass,
        // which we discard here and re-open via a fresh navigation.
        const response = await fetch(appleHref);
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const code =
            body && typeof body === 'object' && 'code' in body
              ? (body as { code: unknown }).code
              : null;
          const reference =
            body && typeof body === 'object' && 'reference' in body
              ? String((body as { reference: unknown }).reference)
              : null;

          setError({
            message: isWalletErrorCode(code)
              ? walletErrorMessage(code)
              : walletErrorMessage('WALLET_GENERATION_FAILED'),
            reference,
          });
          return;
        }
        window.open(appleHref, '_blank', 'noopener,noreferrer');
      } catch {
        setError({
          message: walletErrorMessage('WALLET_GENERATION_FAILED'),
          reference: null,
        });
      }
    })();
  };

  const showGoogle = platform === 'desktop' || platform === 'android';
  const showApple = platform === 'desktop' || platform === 'ios';

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <p className="text-sm text-slate-500">Add to Wallet</p>

      <div className="flex flex-row items-center justify-center gap-3">
        <If condition={showApple}>
          <a
            href={appleHref}
            onClick={handleAppleClick}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Add to Apple Wallet"
            data-test="add-to-apple-wallet-button"
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
            disabled={isGooglePending}
            aria-label="Add to Google Wallet"
            data-test="add-to-google-wallet-button"
            className="transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <If
              condition={isGooglePending}
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

      <If condition={error}>
        {(walletError) => (
          <Alert variant="destructive" className="mt-1">
            <AlertDescription data-test="wallet-error">
              {walletError.message}
              {walletError.reference ? (
                <span className="mt-1 block text-xs opacity-80">
                  Reference: {walletError.reference}
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        )}
      </If>
    </div>
  );
}
