'use client';

import { Building2, Calendar, DollarSign } from 'lucide-react';

import { Badge } from '@kit/ui/badge';

import {
  DB_STATUS_TO_DISPLAY,
  type SaleData,
} from '../_lib/types/sales-filter.types';

interface SaleTileProps {
  sale: SaleData;
}

export function SaleTile({ sale }: SaleTileProps) {
  const formatPrice = (cents: number | null) => {
    if (cents === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const statusDisplay = DB_STATUS_TO_DISPLAY[sale.status] ?? 'Inactive';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <code className="bg-muted rounded px-2 py-1 text-sm font-semibold">
          {sale.display_code}
        </code>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="border-0">
            {sale.card_type === 'digital' ? 'Digital' : 'Physical'}
          </Badge>
          <Badge
            variant="outline"
            className={
              statusDisplay === 'Active'
                ? 'border-0 bg-green-100 text-green-800'
                : 'border-0 bg-gray-100 text-gray-700'
            }
          >
            {statusDisplay}
          </Badge>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-col gap-2 text-sm">
        <span className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4" />
          {sale.organization_name}
        </span>
        <span className="flex items-center gap-1.5">
          <DollarSign className="h-4 w-4" />
          {formatPrice(sale.price_cents)}
        </span>
        {sale.activated_at && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Sold{' '}
            {new Date(sale.activated_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
        {sale.assigned_at && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Assigned{' '}
            {new Date(sale.assigned_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
      </div>
    </div>
  );
}
