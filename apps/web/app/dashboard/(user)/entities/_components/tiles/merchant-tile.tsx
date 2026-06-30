'use client';

import { useState, useTransition } from 'react';

import { ArrowUpRight, Eye, EyeOff, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';
import { Switch } from '@kit/ui/switch';

import { MerchantWithAccount } from '../../_lib/server/entities-page.loader';
import {
  refreshMerchantPasscodeAction,
  toggleMerchantStatusAction,
} from '../../_lib/server/entities-server-actions';

interface MerchantTileProps {
  merchant: MerchantWithAccount;
  onOpenDetails: () => void;
}

export function MerchantTile({ merchant, onOpenDetails }: MerchantTileProps) {
  return (
    <div className="rounded-lg border shadow-sm">
      {/* Header row */}
      <div className="p-4 pb-0">
        <button
          onClick={onOpenDetails}
          className="text-brand flex items-center gap-1 text-left font-semibold hover:underline"
        >
          {merchant.business_name ?? 'N/A'}
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* Contact details - vertical fields */}
      <div className="flex flex-col gap-3 p-4">
        <DetailField
          label="Primary Contact Name"
          value={merchant.primary_contact_name}
        />
        <DetailField
          label="Primary Contact Email"
          value={merchant.primary_contact_email}
        />
        <DetailField
          label="Primary Contact Phone Number"
          value={merchant.contact_phone}
        />
        <DetailField label="Address" value={merchant.address} />
        <PasscodeField
          accountId={merchant.account_id}
          passcode={merchant.passcode}
        />
      </div>

      {/* Status row */}
      <div className="p-4 pt-0">
        <div className="bg-muted/50 flex items-center justify-between rounded-lg px-4 py-3">
          <span className="text-muted-foreground text-sm">Status:</span>
          <StatusToggle merchant={merchant} />
        </div>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm">{label}</span>
      <span className="text-muted-foreground text-sm">{value || 'N/A'}</span>
    </div>
  );
}

function PasscodeField({
  accountId,
  passcode,
}: {
  accountId: string;
  passcode: string | null;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState(passcode);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const result = await refreshMerchantPasscodeAction({ accountId });
        if (result.success && result.passcode) {
          setCurrentPasscode(result.passcode);
          setIsVisible(true);
          toast.success('Passcode refreshed successfully');
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to refresh passcode',
        );
      }
    });
  };

  const displayValue = isVisible ? (currentPasscode ?? 'Not set') : '****';

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm">Passcode</span>
        <span className="text-muted-foreground font-mono text-sm">
          {displayValue}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsVisible(!isVisible)}
          disabled={!currentPasscode}
        >
          {isVisible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleRefresh}
          disabled={isPending}
        >
          {isPending ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function StatusToggle({ merchant }: { merchant: MerchantWithAccount }) {
  const [pending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(merchant.is_active);

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await toggleMerchantStatusAction({
          accountId: merchant.account_id,
          isActive: checked,
        });

        if (result.success) {
          toast.success('Status updated successfully');
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
