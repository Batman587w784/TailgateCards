'use client';

import { useState } from 'react';

import { CreditCard } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Separator } from '@kit/ui/separator';

import type { DiscountPreview } from '../_lib/server/card-activation.loader';
import { PromotionItem } from './promotion-item';

interface CardInfoDisplayProps {
  card: {
    display_code?: string | null;
    organization: {
      name: string;
    };
  };
  discounts?: DiscountPreview[];
}

const DEFAULT_PREVIEW_COUNT = 3;

export function CardInfoDisplay({ card, discounts = [] }: CardInfoDisplayProps) {
  const [showAll, setShowAll] = useState(false);

  const hasDiscounts = discounts.length > 0;
  const hasMore = discounts.length > DEFAULT_PREVIEW_COUNT;
  const visible = showAll
    ? discounts
    : discounts.slice(0, DEFAULT_PREVIEW_COUNT);

  return (
    <div className="bg-muted/30 rounded-lg border p-4">
      {card.display_code ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <CreditCard className="text-muted-foreground h-3.5 w-3.5" />
            <p className="text-muted-foreground text-xs">Card code</p>
          </div>
          <p className="text-foreground text-sm">{card.display_code}</p>
        </div>
      ) : null}

      {hasDiscounts && (
        <>
          {card.display_code ? <Separator className="my-4" /> : null}

          {/* P1-3: "N discounts included" + LASTS 365 DAYS badge. No dollar-
              savings claim — the actual savings depend on how the buyer redeems. */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">
              {discounts.length} discount{discounts.length === 1 ? '' : 's'}{' '}
              included
            </p>
            <Badge
              variant="secondary"
              className="shrink-0 text-[10px] font-semibold tracking-wide uppercase"
            >
              Lasts 365 Days
            </Badge>
          </div>

          <p className="text-muted-foreground mt-1 text-xs">
            Every card unlocks all of these local deals and lasts 365 days.
          </p>

          <Separator className="my-3" />

          <div className="divide-y">
            {visible.map((discount) => (
              <PromotionItem key={discount.id} discount={discount} />
            ))}
          </div>

          {hasMore && (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'Show less' : `Show all ${discounts.length}`}
            </Button>
          )}

          <p className="text-muted-foreground mt-3 text-xs">
            Tailgate reserves the right to modify or discontinue any promotional
            campaigns or discounts at its discretion.
          </p>
        </>
      )}
    </div>
  );
}
