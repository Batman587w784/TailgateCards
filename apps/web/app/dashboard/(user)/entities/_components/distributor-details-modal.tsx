'use client';

import { useState, useTransition } from 'react';

import {
  CalendarDays,
  GalleryVerticalEnd,
  Mail,
  TicketPercent,
  WalletCards,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Separator } from '@kit/ui/separator';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { DistributorAccount } from '../_lib/server/entities-page.loader';
import {
  resendEntityInviteAction,
  updateDistributorAction,
} from '../_lib/server/entities-server-actions';

interface DistributorDetailsModalProps {
  distributor: DistributorAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DistributorDetailsModal({
  distributor,
  open,
  onOpenChange,
}: DistributorDetailsModalProps) {
  const [pending, startTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const [isActive, setIsActive] = useState(distributor.is_active);

  const handleStatusChange = (checked: boolean) => {
    setIsActive(checked);
    startTransition(async () => {
      try {
        const result = await updateDistributorAction({
          accountId: distributor.id,
          phone: distributor.phone ?? undefined,
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

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Distributor Details
          </DialogTitle>
          <DialogDescription>
            See the full info for this distributor.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-6">
          {/* Identity row */}
          <div className="flex items-center justify-between">
            <h3 className="text-brand text-lg">
              <span className="font-semibold">{distributor.name}</span>
              {distributor.organization_name && (
                <span> - {distributor.organization_name}</span>
              )}
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resendPending}
              onClick={() => {
                startResendTransition(async () => {
                  try {
                    const result = await resendEntityInviteAction({
                      accountId: distributor.id,
                      entityType: 'distributor',
                    });

                    if (result.success) {
                      toast.success('Invite email resent successfully');
                    } else {
                      toast.error(
                        'error' in result
                          ? result.error
                          : 'Failed to resend invite',
                      );
                    }
                  } catch {
                    toast.error('Failed to resend invite');
                  }
                });
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              {resendPending ? 'Sending...' : 'Resend Invite'}
            </Button>
          </div>

          {/* Metrics grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <TicketPercent className="h-4 w-4" />
              <span>
                Total Revenue:{' '}
                <span className="text-foreground font-medium">
                  {formatCurrency(distributor.total_earnings_cents ?? 0)}
                </span>
              </span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4" />
              <span>Created at {formatDate(distributor.created_at)}</span>
            </div>
            {distributor.assigned_cards !== undefined && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <WalletCards className="h-4 w-4" />
                <span>Assigned Cards: {distributor.assigned_cards}</span>
              </div>
            )}
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <GalleryVerticalEnd className="h-4 w-4" />
              <span>Card Batches: {distributor.batch_count ?? 0}</span>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Contact details */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-muted-foreground text-sm">
                {distributor.email ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Distributor Phone number</p>
              <p className="text-muted-foreground text-sm">
                {distributor.phone
                  ? formatPhoneNumber(distributor.phone)
                  : 'N/A'}
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Status row */}
          <div className="bg-muted flex items-center justify-between rounded-md px-4 py-3">
            <span className="text-muted-foreground text-sm">Status:</span>
            <Switch
              checked={isActive}
              onCheckedChange={handleStatusChange}
              disabled={pending}
              className="data-[state=checked]:bg-green-500"
              data-test="distributor-status-modal-toggle"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
