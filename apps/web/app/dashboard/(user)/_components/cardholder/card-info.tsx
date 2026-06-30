'use client';

import { useState } from 'react';

import { format } from 'date-fns';
import { CreditCard, Search } from 'lucide-react';
import QRCode from 'react-qr-code';

import { Card, CardContent } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import { TailgateLogo } from '~/components/tailgate-logo';
import appConfig from '~/config/app.config';

import { CardholderCard } from '../../_lib/server/cardholder-page.loader';
import { QRCodeModal } from './qr-code-modal';

interface CardInfoProps {
  card: CardholderCard;
  className?: string;
}

function getValidationUrl(cardId: string): string {
  return `${appConfig.url}/validate?card_id=${cardId}`;
}

export function CardInfo({ card }: CardInfoProps) {
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const validationUrl = getValidationUrl(card.id);
  const expirationDate = card.expires_at
    ? format(new Date(card.expires_at), 'MM/dd/yyyy')
    : 'No expiration';

  // Only show QR for activated cards
  const showQr = card.status === 'activated';

  return (
    <>
      {/* Shadow wrapper - not clipped so shadow renders fully */}
      <div className="aspect-8/5 drop-shadow-sm sm:aspect-auto">
        <Card
          className={cn(
            'relative h-full overflow-hidden rounded-3xl border-0 bg-white/70',
            'backdrop-blur supports-backdrop-filter:bg-white/60',
            '[clip-path:polygon(0_0,calc(100%-40px)_0,100%_20px,100%_100%,0_100%)]',
          )}
        >
          {/* Background texture + soft gradients */}
          <div className="pointer-events-none absolute inset-0">
            {/* diagonal sweep */}
            <div
              className="absolute inset-0 opacity-80"
              style={{
                backgroundImage:
                  'linear-gradient(115deg, rgba(0,0,0,0.05), rgba(0,0,0,0.00) 40%, rgba(0,0,0,0.06))',
              }}
            />
            {/* subtle check pattern */}
            <div
              className="absolute inset-0 opacity-35"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, rgba(0,0,0,0.05) 25%, transparent 25%),' +
                  'linear-gradient(-45deg, rgba(0,0,0,0.05) 25%, transparent 25%),' +
                  'linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.05) 75%),' +
                  'linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.05) 75%)',
                backgroundSize: '18px 18px',
                backgroundPosition: '0 0, 0 9px, 9px -9px, -9px 0px',
              }}
            />
            {/* soft blobs to mimic the right-side wash */}
            <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-black/10 blur-3xl" />
            <div className="absolute top-10 -right-10 h-56 w-56 rounded-full bg-black/5 blur-2xl" />
          </div>

          <CardContent className="relative p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              {/* Left content */}
              <div className="space-y-4">
                <div className="text-sm font-medium tracking-wide text-black/85">
                  {card.display_code}
                </div>

                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-black/60">
                      Organization
                    </div>
                    <div className="text-xs font-medium text-black/85">
                      {card.organization.name}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[10px] text-black/60">
                      Expiration Date
                    </div>
                    <div className="text-xs font-medium text-black/85">
                      {expirationDate}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right content */}
              <div className="flex shrink-0 flex-col items-end gap-4">
                {/* Tailgate logo */}
                <TailgateLogo className="h-8 w-auto opacity-70" />

                {/* QR */}
                {showQr && (
                  <button
                    onClick={() => setQrModalOpen(true)}
                    className="relative rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5 transition-transform hover:scale-105"
                    aria-label="Enlarge QR code"
                    data-test="qr-code-enlarge-button"
                  >
                    <div className="rounded-xl bg-white p-0.5">
                      <QRCode
                        value={validationUrl}
                        size={75}
                        style={{ height: '75px', width: '75px' }}
                        aria-label="Verification QR code"
                      />
                    </div>

                    {/* center overlay */}
                    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-lg ring-2 ring-white/80">
                        <Search className="h-4 w-4 text-white" aria-hidden />
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showQr && (
        <QRCodeModal
          open={qrModalOpen}
          onOpenChange={setQrModalOpen}
          value={validationUrl}
        />
      )}
    </>
  );
}

export function CardInfoEmpty() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="bg-muted rounded-lg p-3">
          <CreditCard className="text-muted-foreground h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-muted-foreground font-medium">No Active Card</p>
          <p className="text-muted-foreground text-sm">
            Activate a card to see details
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
