'use client';

import { format } from 'date-fns';

import { Badge } from '@kit/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import { DiscountWithMerchant } from '../_lib/server/discounts-page.loader';

interface DiscountDetailsModalProps {
  discount: DiscountWithMerchant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getDiscountStatus(
  discount: DiscountWithMerchant,
): 'Active' | 'Inactive' | 'Expired' | 'Scheduled' {
  const now = new Date();
  const validFrom = new Date(discount.valid_from);
  const validUntil = discount.valid_until
    ? new Date(discount.valid_until)
    : null;

  if (!discount.is_active) {
    return 'Inactive';
  }

  if (validUntil && now > validUntil) {
    return 'Expired';
  }

  if (now < validFrom) {
    return 'Scheduled';
  }

  return 'Active';
}

function getStatusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'Active':
      return 'default';
    case 'Inactive':
      return 'secondary';
    case 'Expired':
      return 'destructive';
    case 'Scheduled':
      return 'outline';
    default:
      return 'secondary';
  }
}

export function DiscountDetailsModal({
  discount,
  open,
  onOpenChange,
}: DiscountDetailsModalProps) {
  const status = getDiscountStatus(discount);

  const formatDate = (date: string | null) => {
    if (!date) return 'No end date';
    return format(new Date(date), 'MMM dd, yyyy');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-normal">
            Discount Details
          </DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          View the full details for this discount.
        </p>

        <div className="mt-4 space-y-4 rounded-lg bg-slate-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
            </div>
          </div>

          <div>
            <h3 className="text-brand text-xl font-semibold">
              {discount.title}
            </h3>
            <p className="text-muted-foreground text-sm">
              {discount.merchant.business_name ?? 'Unknown Merchant'}
              {discount.merchant.city && ` • ${discount.merchant.city}`}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground text-sm">Redemptions</span>
              <span className="font-medium">
                {discount.redemption_count.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground text-sm">Validity</span>
              <span className="font-medium">
                {formatDate(discount.valid_from)} -{' '}
                {formatDate(discount.valid_until)}
              </span>
            </div>

            {discount.merchant.address && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Address</span>
                <span className="max-w-[200px] text-right font-medium">
                  {discount.merchant.address}
                </span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
