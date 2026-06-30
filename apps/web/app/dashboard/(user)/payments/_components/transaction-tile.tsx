'use client';

import { CalendarDays, Receipt } from 'lucide-react';

import { Badge } from '@kit/ui/badge';

import type { PaymentTransaction } from '../_lib/schemas/payment.schema';
import {
  formatCurrency,
  formatDate,
  formatTransactionId,
} from '../_lib/schemas/payment.schema';

interface TransactionTileProps {
  transaction: PaymentTransaction;
}

export function TransactionTile({ transaction }: TransactionTileProps) {
  return (
    <div className="space-y-3 rounded-lg bg-slate-100 p-4">
      {/* Top row: Transaction ID + Status */}
      <div className="flex items-center justify-between">
        <span className="text-brand font-bold">
          Transaction ID: {formatTransactionId(transaction.transaction_id)}
        </span>
        <StatusBadge status={transaction.status} />
      </div>

      {/* Organization name */}
      <p className="text-muted-foreground text-sm">
        {transaction.organization_name ?? 'Unknown Organization'}
      </p>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Left: Card ID */}
        <div className="flex flex-col gap-1">
          <span className="text-foreground text-xs">Card ID</span>
          <span className="text-muted-foreground truncate text-xs">
            {transaction.card_id}
          </span>
        </div>

        {/* Right: Amount + Date */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Receipt className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-muted-foreground text-xs">
              Amount: {formatCurrency(transaction.amount_cents)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-muted-foreground text-xs">
              {formatDate(transaction.date)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'successful' | 'failed' }) {
  if (status === 'successful') {
    return <Badge className="bg-green-500 text-white">Successful</Badge>;
  }

  return <Badge className="bg-red-800 text-white">Failed</Badge>;
}
