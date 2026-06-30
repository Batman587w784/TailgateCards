'use client';

import { useState, useTransition } from 'react';

import { ArrowUpRight, Calendar, Receipt } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { OrganizationWithAccount } from '../../_lib/server/entities-page.loader';
import { toggleOrganizationStatusAction } from '../../_lib/server/entities-server-actions';

interface OrganizationTileProps {
  organization: OrganizationWithAccount;
  onOpenDetails: () => void;
}

export function OrganizationTile({
  organization,
  onOpenDetails,
}: OrganizationTileProps) {
  return (
    <div className="rounded-lg border shadow-sm">
      <div className="p-4 pb-0">
        <button
          onClick={onOpenDetails}
          className="text-brand flex items-center gap-1 text-left font-semibold hover:underline"
        >
          {organization.organization_name ?? 'N/A'}
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="flex items-center gap-1.5">
          <Receipt className="h-4 w-4" />
          Total Revenue: {formatCurrency(organization.total_revenue)}
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          Created at{' '}
          {organization.created_at
            ? new Date(organization.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A'}
        </span>
      </div>

      <div className="p-4 pt-0">
        <div className="bg-muted/50 flex items-center justify-between rounded-lg px-4 py-3">
          <span className="text-muted-foreground text-sm">Status:</span>
          <StatusToggle organization={organization} />
        </div>
      </div>
    </div>
  );
}

function StatusToggle({
  organization,
}: {
  organization: OrganizationWithAccount;
}) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(organization.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleOrganizationStatusAction({
          accountId: organization.account_id,
          isActive: checked,
        });

        if (result.success) {
          if (checked) {
            toast.success('Organization activated successfully.');
          } else {
            toast.error('Organization deactivated successfully.');
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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
