'use client';

import Image from 'next/image';

import { MapPin, Store, UtensilsCrossed } from 'lucide-react';

import type { DiscountPreview } from '../_lib/server/card-activation.loader';

export function PromotionItem({ discount }: { discount: DiscountPreview }) {
  const { merchant } = discount;

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="bg-muted flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl">
        {merchant.picture_url ? (
          <Image
            src={merchant.picture_url}
            alt={merchant.business_name}
            width={56}
            height={56}
            className="h-full w-full object-cover"
          />
        ) : (
          <Store className="text-muted-foreground h-6 w-6" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{discount.title}</p>

        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <UtensilsCrossed className="h-3 w-3 shrink-0" />
          <span className="truncate">{merchant.business_name}</span>
        </p>

        {(merchant.address || merchant.city) && (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {[merchant.address, merchant.city].filter(Boolean).join(', ')}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
