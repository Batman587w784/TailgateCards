'use client';

import { CalendarCheck, CalendarDays, User, UserCheck } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Checkbox } from '@kit/ui/checkbox';
import { Separator } from '@kit/ui/separator';

import type { OrgCard } from '../_lib/server/cards-page.loader';
import type { DistributorOption } from '../_lib/server/cards-page.loader';
import { AssignDistributorDropdown } from './assign-distributor-dropdown';

interface CardTileProps {
  card: OrgCard;
  distributors: DistributorOption[];
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'activated':
      return (
        <Badge className="border-transparent bg-green-500 text-white">
          Activated
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="border-transparent bg-yellow-500 text-white">
          Pending
        </Badge>
      );
    case 'expired':
      return (
        <Badge className="border-transparent bg-gray-500 text-white">
          Expired
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge className="border-transparent bg-red-500 text-white">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CardTile({
  card,
  distributors,
  isSelected,
  onSelect,
}: CardTileProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 ${isSelected ? 'bg-[#EFF6FF]' : ''}`}
      data-test="card-tile"
    >
      {/* Header: Checkbox + Card Code + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isSelected}
            className="data-[state=checked]:bg-brand data-[state=checked]:border-brand"
            onCheckedChange={(checked) => onSelect(checked === true)}
            aria-label={`Select card ${card.display_code}`}
            data-test="card-tile-checkbox"
          />
          <span
            className="text-brand text-lg font-bold"
            data-test="card-tile-code"
          >
            {card.display_code}
          </span>
        </div>
        {getStatusBadge(card.status)}
      </div>

      {/* Info Grid */}
      <div className="text-muted-foreground flex flex-col gap-2 text-xs">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4 shrink-0" />
            {card.distributor_name ?? 'Unassigned'}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" />
            Assigned: {formatDate(card.assigned_at)}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarCheck className="h-4 w-4 shrink-0" />
            Activated: {formatDate(card.activated_at)}
          </span>
          {card.cardholder_name && (
            <span className="flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 shrink-0" />
              {card.cardholder_name}
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Assign Button */}
      <div className="flex justify-end">
        <AssignDistributorDropdown
          cardId={card.id}
          currentDistributorId={card.distributor_id}
          distributors={distributors}
        />
      </div>
    </div>
  );
}
