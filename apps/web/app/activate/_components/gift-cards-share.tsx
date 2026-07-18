'use client';

import { useState } from 'react';

import { Check, Copy, Gift } from 'lucide-react';

import { Button } from '@kit/ui/button';

import type { GiftCard } from './shared-payment-form';

interface GiftCardsShareProps {
  giftCards: GiftCard[];
}

function claimUrl(claimToken: string) {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/activate/${claimToken}`;
}

export function GiftCardsShare({ giftCards }: GiftCardsShareProps) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  if (giftCards.length === 0) {
    return null;
  }

  const copy = async (claimToken: string) => {
    try {
      await navigator.clipboard.writeText(claimUrl(claimToken));
      setCopiedToken(claimToken);
      window.setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Clipboard can be blocked (permissions / insecure context). Leave the
      // link visible so the buyer can still select and copy it manually.
      setCopiedToken(null);
    }
  };

  return (
    <div
      className="bg-sidebar flex flex-col gap-4 rounded-lg border p-4"
      data-test="gift-cards-share"
    >
      <div className="flex items-start gap-3">
        <div className="bg-brand/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <Gift className="text-brand h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            Share your {giftCards.length} extra{' '}
            {giftCards.length === 1 ? 'card' : 'cards'}
          </p>
          <p className="text-muted-foreground text-sm">
            You activated one card for yourself. Send each link below to a friend
            — they&apos;ll activate their own card. We also emailed you these
            links.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {giftCards.map((card) => {
          const isCopied = copiedToken === card.claimToken;

          return (
            <li
              key={card.claimToken}
              className="bg-background flex items-center gap-3 rounded-md border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{card.cardCode}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {claimUrl(card.claimToken)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                data-test="copy-gift-link"
                onClick={() => copy(card.claimToken)}
              >
                {isCopied ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" />
                    Copy link
                  </>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
