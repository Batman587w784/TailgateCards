'use client';

import { useState, useTransition } from 'react';

import {
  CalendarDays,
  FolderOpen,
  HandCoins,
  Package,
  TicketPercent,
} from 'lucide-react';

import { Separator } from '@kit/ui/separator';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import type { OrgDistributor } from '../_lib/server/distributors-page.loader';
import { toggleDistributorStatusAction } from '../_lib/server/distributors-server-actions';

interface DistributorTileProps {
  distributor: OrgDistributor;
  onNameClick?: (distributor: OrgDistributor) => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DistributorTile({
  distributor,
  onNameClick,
}: DistributorTileProps) {
  const cardsInHand = distributor.total_cards - distributor.activated_cards;

  return (
    <div className="flex flex-col gap-3">
      {/* Header: Name */}
      <div>
        <button
          type="button"
          onClick={() => onNameClick?.(distributor)}
          className="text-brand text-left text-lg font-bold"
          data-test="distributor-tile-name"
        >
          {distributor.name}
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="text-muted-foreground flex flex-col gap-2 text-xs">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <TicketPercent className="h-4 w-4 shrink-0" />
            Total Revenue: {formatCurrency(distributor.total_earnings_cents)}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" />
            Created at {formatDate(distributor.created_at)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <Package className="h-4 w-4 shrink-0" />
            Total Cards Assigned: {distributor.total_cards.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <FolderOpen className="h-4 w-4 shrink-0" />
            Cards Sold: {distributor.activated_cards.toLocaleString()}
          </span>
        </div>

        <span className="flex items-center gap-1.5">
          <HandCoins className="h-4 w-4 shrink-0" />
          Cards in Hand: {cardsInHand.toLocaleString()}
        </span>
      </div>

      <Separator />

      {/* Contact Info */}
      <div className="flex flex-col gap-2 text-sm">
        <div>
          <p className="font-semibold">Email</p>
          <p className="text-muted-foreground">{distributor.email ?? '-'}</p>
        </div>
        <div>
          <p className="font-semibold">Distributor Phone number</p>
          <p className="text-muted-foreground">{distributor.phone ?? '-'}</p>
        </div>
      </div>

      <Separator />

      {/* Status Toggle */}
      <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2">
        <span className="text-muted-foreground text-sm">Status:</span>
        <StatusToggle distributor={distributor} />
      </div>
    </div>
  );
}

function StatusToggle({ distributor }: { distributor: OrgDistributor }) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(distributor.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleDistributorStatusAction({
          distributorId: distributor.id,
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

  return (
    <Switch
      checked={isActive}
      onCheckedChange={handleToggle}
      disabled={pending}
      className="data-[state=checked]:bg-green-500"
      data-test="distributor-tile-status-toggle"
    />
  );
}
