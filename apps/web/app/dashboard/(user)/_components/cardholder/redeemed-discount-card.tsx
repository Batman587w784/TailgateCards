import { Calendar, CheckCircle, MapPin, Tag } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Card, CardContent, CardHeader } from '@kit/ui/card';

import { RedeemedDiscount } from '../../_lib/server/cardholder-page.loader';

interface RedeemedDiscountCardProps {
  discount: RedeemedDiscount;
}

export function RedeemedDiscountCard({ discount }: RedeemedDiscountCardProps) {
  const redeemedDate = formatDate(discount.redeemed_at);

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          {discount.category && (
            <Badge variant="secondary" className="text-xs">
              {discount.category}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs font-medium">
            <CheckCircle className="mr-1 h-3 w-3" />
            Redeemed
          </Badge>
        </div>
        <h3 className="mt-2 text-lg leading-tight font-semibold">
          {discount.title}
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          {discount.merchant.picture_url ? (
            <div className="bg-muted h-10 w-10 shrink-0 overflow-hidden rounded-lg">
              <img
                src={discount.merchant.picture_url}
                alt={discount.merchant.business_name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Tag className="text-muted-foreground h-5 w-5" />
            </div>
          )}
          <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
            <span className="truncate">{discount.merchant.business_name}</span>
          </div>
        </div>

        {discount.merchant.address && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{discount.merchant.address}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-2">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            <span>Redeemed {redeemedDate}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>Used</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
