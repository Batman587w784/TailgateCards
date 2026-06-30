'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import { DiscountWithMerchant } from '../_lib/server/discounts-page.loader';
import { EditDiscountForm } from './edit-discount-form';

interface EditDiscountModalProps {
  discount: DiscountWithMerchant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDiscountModal({
  discount,
  open,
  onOpenChange,
}: EditDiscountModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Discount</DialogTitle>
          <DialogDescription>
            Update the details for this discount.
          </DialogDescription>
        </DialogHeader>

        <EditDiscountForm
          discount={discount}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
