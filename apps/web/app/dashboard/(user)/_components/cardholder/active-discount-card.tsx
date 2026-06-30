'use client';

import { MapPin, Ticket } from 'lucide-react';

import { Card, CardContent } from '@kit/ui/card';

import { ActiveDiscountWithUsage } from '../../_lib/server/cardholder-page.loader';

interface ActiveDiscountCardProps {
  discount: ActiveDiscountWithUsage;
}

export function ActiveDiscountCard({ discount }: ActiveDiscountCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="mb-2 flex items-start gap-3">
          {discount.merchant.picture_url ? (
            <div className="bg-muted h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <img
                src={discount.merchant.picture_url}
                alt={discount.merchant.business_name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
              <MapPin className="text-muted-foreground h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-foreground mb-1 text-sm font-semibold">
              {discount.title}
            </h3>
            <p className="text-muted-foreground text-xs">
              {discount.merchant.business_name}
            </p>
          </div>
        </div>

        <div className="text-muted-foreground space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <Ticket className="h-3 w-3 shrink-0" />
            <span>
              Used <span className="font-medium">{discount.usageCount}</span>{' '}
              {discount.usageCount === 1 ? 'time' : 'times'}
            </span>
          </div>

          {discount.merchant.address && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>{discount.merchant.address}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
