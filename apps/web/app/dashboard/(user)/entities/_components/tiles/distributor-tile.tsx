'use client';

import { useState, useTransition } from 'react';

import { ArrowUpRight, Building2, Calendar, ShoppingCart } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { DistributorAccount } from '../../_lib/server/entities-page.loader';
import { toggleDistributorStatusAction } from '../../_lib/server/entities-server-actions';

interface DistributorTileProps {
  distributor: DistributorAccount;
  onOpenDetails: () => void;
}

export function DistributorTile({
  distributor,
  onOpenDetails,
}: DistributorTileProps) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          onClick={onOpenDetails}
          className="text-brand flex items-center gap-1 text-left font-semibold hover:underline"
        >
          {distributor.name ?? 'N/A'}
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4" />
          {distributor.organization_name ?? 'No Organization'}
        </span>
        <span className="flex items-center gap-1.5">
          <ShoppingCart className="h-4 w-4" />
          Total Sales: {distributor.total_sales.toLocaleString()}
        </span>
      </div>

      <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <Calendar className="h-4 w-4" />
        Created at{' '}
        {distributor.created_at
          ? new Date(distributor.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'N/A'}
      </div>

      <div className="bg-muted/50 flex items-center gap-3 rounded-lg px-4 py-3">
        <span className="text-muted-foreground text-sm">Status:</span>
        <StatusToggle distributor={distributor} />
      </div>
    </div>
  );
}

function StatusToggle({ distributor }: { distributor: DistributorAccount }) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(distributor.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleDistributorStatusAction({
          accountId: distributor.id,
          isActive: checked,
        });

        if (result.success) {
          if (checked) {
            toast.success('Distributor activated successfully.');
          } else {
            toast.error('Distributor deactivated successfully.');
          }
        } else {
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
    />
  );
}
