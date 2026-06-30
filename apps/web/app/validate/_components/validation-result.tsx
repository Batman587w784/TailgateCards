'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { AlertCircle, CreditCard } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { toast } from '@kit/ui/sonner';

import { recordRedemption } from '../_lib/server/card-validation.actions';
import type {
  CardValidationData,
  MerchantDiscountData,
} from '../_lib/server/card-validation.loader';
import { redemptionErrorMessage } from '../_lib/validation-errors';

interface ValidationResultProps {
  cardData: CardValidationData;
  discounts: MerchantDiscountData[];
  merchantId: string;
}

export function ValidationResult({
  cardData,
  discounts,
  merchantId,
}: ValidationResultProps) {
  if (!cardData.valid || !cardData.card) {
    return <InvalidCardResult error={cardData.error ?? 'Card is invalid'} />;
  }

  return (
    <ValidCardResult
      card={cardData.card}
      discounts={discounts}
      merchantId={merchantId}
    />
  );
}

function InvalidCardResult({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <AlertCircle className="h-10 w-10 text-red-600" />
      </div>
      <div>
        <Heading level={3} className="mb-2 text-red-600">
          Invalid Card
        </Heading>
        <p className="text-muted-foreground">{error}</p>
      </div>
    </div>
  );
}

interface ValidCardResultProps {
  card: NonNullable<CardValidationData['card']>;
  discounts: MerchantDiscountData[];
  merchantId: string;
}

function ValidCardResult({
  card,
  discounts,
  merchantId,
}: ValidCardResultProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Get the first discount for display
  const discount = discounts[0];

  // Format expiry date
  const validityDate = card.expires_at
    ? new Date(card.expires_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const handleApplyDiscount = () => {
    if (!discount) {
      toast.error('No discount available');
      return;
    }

    startTransition(async () => {
      const result = await recordRedemption({
        cardId: card.id,
        discountId: discount.id,
        merchantId,
      });

      if (!result.success) {
        toast.error(redemptionErrorMessage(result.code), {
          description: `Reference: ${result.reference}`,
        });
        return;
      }

      toast.success('Discount applied successfully');
      router.push('/dashboard');
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Card ID section */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="text-muted-foreground h-5 w-5" />
          <span className="text-muted-foreground text-sm">Card ID</span>
        </div>
        <p className="mt-2 pl-7 font-mono text-lg font-medium">
          {card.display_code}
        </p>
      </div>

      {/* Discount info section */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-col gap-3">
          <div>
            <span className="font-medium">Discount: </span>
            <span>{discount ? discount.title : 'No discount'}</span>
          </div>
          <div>
            <span className="font-medium">Card : </span>
            <span className="text-green-600">Active</span>
          </div>
          {validityDate && (
            <div>
              <span className="font-medium">Validity Date : </span>
              <span className="text-green-600">{validityDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* Apply Discount / Done button */}
      {discount ? (
        <Button
          className="w-full"
          onClick={handleApplyDiscount}
          disabled={isPending}
        >
          {isPending ? 'Applying...' : 'Apply Discount'}
        </Button>
      ) : (
        <Button
          variant="outline"
          className="w-full border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
          onClick={() => router.push('/dashboard')}
        >
          Done
        </Button>
      )}
    </div>
  );
}
