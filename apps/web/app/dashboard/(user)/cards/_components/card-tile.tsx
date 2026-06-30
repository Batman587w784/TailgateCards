'use client';

import { Building2, Calendar, User } from 'lucide-react';

import { Badge } from '@kit/ui/badge';

import { CardData } from '../../entities/_lib/server/entities-page.loader';
import { DB_STATUS_TO_DISPLAY } from '../_lib/types/filter.types';

interface CardTileProps {
  card: CardData;
}

const statusConfig: Record<CardData['status'], string> = {
  pending: 'bg-stone-300 text-stone-700',
  paid: 'bg-stone-300 text-stone-700',
  activated: 'bg-green-500 text-white',
  expired: 'bg-red-300 text-red-900',
  cancelled: 'bg-stone-300 text-stone-700',
};

export function CardTile({ card }: CardTileProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <code className="bg-muted rounded px-2 py-1 text-sm font-semibold">
          {card.display_code}
        </code>
        <Badge
          variant="outline"
          className={`border-0 ${statusConfig[card.status]}`}
        >
          {DB_STATUS_TO_DISPLAY[card.status] ?? card.status}
        </Badge>
      </div>

      <div className="text-muted-foreground flex flex-col gap-2 text-sm">
        <span className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4" />
          {card.organization_name}
        </span>
        {card.distributor_name && (
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            {card.distributor_name}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          Created{' '}
          {card.created_at
            ? new Date(card.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A'}
        </span>
        {card.activated_at && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Activated{' '}
            {new Date(card.activated_at).toLocaleDateString('en-US', {
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
