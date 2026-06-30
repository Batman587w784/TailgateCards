'use client';

import { CalendarClock, CalendarDays, TicketPercent } from 'lucide-react';

import { CardholderData } from '../../_lib/server/entities-page.loader';

interface CardholderTileProps {
  cardholder: CardholderData;
}

export function CardholderTile({ cardholder }: CardholderTileProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="rounded-lg border p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-brand font-semibold">
            {cardholder.cardholder_name ?? 'Unknown'}
          </p>
          <p className="text-foreground text-sm">
            Card ID: {cardholder.display_code}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <CalendarClock className="h-4 w-4" />
            Expires on {formatDate(cardholder.expires_at)}
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <CalendarDays className="h-4 w-4" />
            Activated at {formatDate(cardholder.activation_date)}
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <TicketPercent className="h-4 w-4" />
            Use Count: {cardholder.total_redemptions}
          </span>
        </div>
      </div>
    </div>
  );
}
