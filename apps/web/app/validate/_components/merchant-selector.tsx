'use client';

import { Store } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';

import type { MerchantAccountData } from '../_lib/server/card-validation.loader';

interface MerchantSelectorProps {
  merchants: MerchantAccountData[];
  cardCode?: string;
  cardId?: string;
}

export function MerchantSelector({
  merchants,
  cardCode,
  cardId,
}: MerchantSelectorProps) {
  const cardParam = cardId
    ? `card_id=${encodeURIComponent(cardId)}`
    : `code=${encodeURIComponent(cardCode ?? '')}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <Heading level={4} className="mb-2">
          Select Your Location
        </Heading>
        <p className="text-muted-foreground">
          Choose which merchant location you&apos;re validating from.
        </p>
      </div>

      <div className="space-y-3">
        {merchants.map((merchant) => (
          <Button
            key={merchant.id}
            variant="outline"
            className="h-auto w-full justify-start p-4"
            asChild
          >
            <a href={`/validate?${cardParam}&merchant=${merchant.id}`}>
              <Store className="mr-3 h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">{merchant.name}</p>
              </div>
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
