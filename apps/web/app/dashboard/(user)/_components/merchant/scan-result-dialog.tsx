'use client';

import { useTransition } from 'react';

import { OctagonAlert } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

import { recordRedemption } from '~/validate/_lib/server/card-validation.actions';
import { redemptionErrorMessage } from '~/validate/_lib/validation-errors';

interface CardData {
  cardId: string;
  cardCode: string;
  discount: { id: string; title: string } | null;
  status: 'active' | 'expired';
  validityDate: string | null;
}

interface ScanResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardData: CardData | null;
  merchantId: string;
  isPending?: boolean;
}

export function ScanResultDialog({
  open,
  onOpenChange,
  cardData,
  merchantId,
  isPending: externalPending,
}: ScanResultDialogProps) {
  if (!cardData) return null;

  const isExpired = cardData.status === 'expired';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        {isExpired ? (
          <ExpiredView cardData={cardData} />
        ) : (
          <SuccessView
            cardData={cardData}
            merchantId={merchantId}
            onClose={() => onOpenChange(false)}
            externalPending={externalPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessView({
  cardData,
  merchantId,
  onClose,
  externalPending,
}: {
  cardData: CardData;
  merchantId: string;
  onClose: () => void;
  externalPending?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || externalPending;

  const handleApplyDiscount = () => {
    if (!cardData.discount) {
      toast.error('No discount available');
      return;
    }

    startTransition(async () => {
      const result = await recordRedemption({
        cardId: cardData.cardId,
        discountId: cardData.discount!.id,
        merchantId,
      });

      if (!result.success) {
        toast.error(redemptionErrorMessage(result.code), {
          description: `Reference: ${result.reference}`,
        });
        return;
      }

      toast.success('Discount applied successfully');
      onClose();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">
          <Trans i18nKey="merchant:scan.cardScanned" defaults="Card Scanned" />
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="bg-muted rounded-lg p-4">
          <p className="text-muted-foreground mb-1 text-sm">
            <Trans i18nKey="merchant:scan.cardId" defaults="Card ID" />
          </p>
          <p className="font-mono text-base font-medium">{cardData.cardCode}</p>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                <Trans i18nKey="merchant:scan.discount" defaults="Discount" />
              </span>
              <span className="text-sm font-medium">
                {cardData.discount?.title ?? 'No discount'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                <Trans i18nKey="merchant:scan.card" defaults="Card" />
              </span>
              <span className="text-sm font-medium">
                <Trans i18nKey="merchant:scan.active" defaults="Active" />
              </span>
            </div>
            {cardData.validityDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">
                  <Trans
                    i18nKey="merchant:scan.validityDate"
                    defaults="Validity Date"
                  />
                </span>
                <span className="text-sm font-medium">
                  {cardData.validityDate}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <DialogFooter className="mt-2">
        {cardData.discount ? (
          <Button
            className="w-full"
            onClick={handleApplyDiscount}
            disabled={isLoading}
          >
            {isLoading ? (
              <Trans i18nKey="common:applying" defaults="Applying..." />
            ) : (
              <Trans
                i18nKey="merchant:scan.applyDiscount"
                defaults="Apply Discount"
              />
            )}
          </Button>
        ) : (
          <Button className="w-full" onClick={onClose}>
            <Trans i18nKey="common:done" defaults="Done" />
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function ExpiredView({ cardData }: { cardData: CardData }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">
          <Trans i18nKey="merchant:scan.cardExpired" defaults="Card Expired" />
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-300">
          <OctagonAlert className="h-8 w-8 text-red-700" />
        </div>

        <h2 className="text-2xl font-bold">
          <Trans i18nKey="merchant:scan.cardExpired" defaults="Card Expired" />
        </h2>
      </div>

      <div className="mt-2 flex flex-col gap-4">
        <div className="bg-muted rounded-lg p-4">
          <p className="text-muted-foreground mb-1 text-sm">
            <Trans i18nKey="merchant:scan.cardId" defaults="Card ID" />
          </p>
          <p className="font-mono text-base font-medium">{cardData.cardCode}</p>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                <Trans i18nKey="merchant:scan.discount" defaults="Discount" />
              </span>
              <span className="text-sm font-medium">
                {cardData.discount?.title ?? 'No discount'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                <Trans i18nKey="merchant:scan.card" defaults="Card" />
              </span>
              <span className="text-sm font-medium text-red-600">
                <Trans i18nKey="merchant:scan.expired" defaults="Expired" />
              </span>
            </div>
            {cardData.validityDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">
                  <Trans
                    i18nKey="merchant:scan.validityDate"
                    defaults="Validity Date"
                  />
                </span>
                <span className="text-sm font-medium text-red-600">
                  {cardData.validityDate}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
