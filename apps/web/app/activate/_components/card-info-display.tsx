'use client';

import { useState } from 'react';

import { ArrowRight, CreditCard } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { ScrollArea } from '@kit/ui/scroll-area';
import { Separator } from '@kit/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';

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

const MOBILE_PREVIEW_COUNT = 2;

export function CardInfoDisplay({
  card,
  discounts = [],
}: CardInfoDisplayProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const hasDiscounts = discounts.length > 0;
  const mobilePreview = discounts.slice(0, MOBILE_PREVIEW_COUNT);
  const hasMoreOnMobile = discounts.length > MOBILE_PREVIEW_COUNT;

  return (
    <>
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

            <p className="text-sm">
              <span className="text-brand font-semibold underline underline-offset-2">
                A total of {discounts.length} new promotion
                {discounts.length !== 1 ? 's' : ''}
              </span>{' '}
              <span className="text-muted-foreground">
                will be added to your account with this card.
              </span>
            </p>

            {/* Desktop: always-expanded scrollable list */}
            <div className="hidden md:block">
              <Separator className="my-3" />
              <div className="max-h-[280px] overflow-y-auto">
                <div className="divide-y">
                  {discounts.map((discount) => (
                    <PromotionItem key={discount.id} discount={discount} />
                  ))}
                </div>
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                Tailgate reserves the right to modify or discontinue any
                promotional campaigns or discounts at its discretion.
              </p>
            </div>

            {/* Mobile: 2-item preview + full-width "See all" button */}
            <div className="md:hidden">
              <Separator className="my-3" />
              <div className="divide-y">
                {mobilePreview.map((discount) => (
                  <PromotionItem key={discount.id} discount={discount} />
                ))}
              </div>

              {hasMoreOnMobile && (
                <Button
                  className="bg-brand text-brand-foreground hover:bg-brand/90 mt-3 w-full"
                  onClick={() => setIsSheetOpen(true)}
                >
                  See all
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}

              <p className="text-muted-foreground mt-3 text-xs">
                Tailgate reserves the right to modify or discontinue any
                promotional campaigns or discounts at its discretion.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Mobile: Bottom sheet with full list */}
      {hasDiscounts && (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent side="bottom" className="md:hidden">
            <SheetHeader>
              <SheetTitle>Available Promotions ({discounts.length})</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[60vh] pt-4">
              <div className="divide-y px-1">
                {discounts.map((discount) => (
                  <PromotionItem key={discount.id} discount={discount} />
                ))}
              </div>
              <p className="text-muted-foreground mt-3 px-1 text-xs">
                Tailgate reserves the right to modify or discontinue any
                promotional campaigns or discounts at its discretion.
              </p>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
