'use client';

import { useState, useTransition } from 'react';

import { CalendarDays, Pencil, Ticket } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import type { DiscountWithMerchant } from '../_lib/server/discounts-page.loader';
import { toggleDiscountStatusAction } from '../_lib/server/discounts-server-actions';

interface DiscountTileProps {
  discount: DiscountWithMerchant;
  onEdit: (discount: DiscountWithMerchant) => void;
}

export function DiscountTile({ discount, onEdit }: DiscountTileProps) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(discount.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleDiscountStatusAction({
          discountId: discount.id,
          isActive: checked,
        });

        if (!result.success) {
          setIsActive(!checked);
          toast.error('Failed to update status');
        }
      } catch {
        setIsActive(!checked);
        toast.error('Failed to update status');
      }
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatAddress = () => {
    const parts = [discount.merchant.address, discount.merchant.city].filter(
      Boolean,
    );
    return parts.length > 0 ? parts.join(', ') : 'No address set';
  };

  return (
    <div className="rounded-lg border shadow-sm">
      {/* Row 1: Status badge + Edit button */}
      <div className="flex items-center justify-between p-4 pb-0">
        <Badge
          className={
            isActive
              ? 'bg-green-500 text-white hover:bg-green-500'
              : 'bg-red-800 text-white hover:bg-red-800'
          }
        >
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => onEdit(discount)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      {/* Main content */}
      <div className="space-y-4 p-4">
        {/* Row 2: Title + Merchant */}
        <div>
          <p className="text-brand font-semibold">{discount.title}</p>
          <p className="text-brand text-sm">
            {discount.merchant.business_name ?? 'Unknown Merchant'}
          </p>
        </div>

        {/* Row 3: Metrics */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <Ticket className="h-4 w-4" />
            <span>Total Use: {discount.redemption_count}</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            <span>Created {formatDate(discount.created_at)}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Row 4: Address */}
        <div>
          <p className="text-foreground text-xs font-medium">Address</p>
          <p className="text-muted-foreground text-sm">{formatAddress()}</p>
        </div>
      </div>

      {/* Row 5: Status toggle strip */}
      <div className="p-4 pt-0">
        <div className="bg-muted/50 flex items-center justify-between rounded-lg px-4 py-3">
          <span className="text-muted-foreground text-sm">Status:</span>
          <Switch
            checked={isActive}
            onCheckedChange={handleToggle}
            disabled={pending}
            className="data-[state=checked]:bg-green-500"
          />
        </div>
      </div>
    </div>
  );
}
