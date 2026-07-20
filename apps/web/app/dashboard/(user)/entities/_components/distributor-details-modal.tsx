'use client';

import { useState, useTransition } from 'react';

import {
  CalendarDays,
  GalleryVerticalEnd,
  Mail,
  Pencil,
  Save,
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
import { Input } from '@kit/ui/input';
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
  /**
   * Role-correct name save. Defaults to the super-admin action (entities
   * screen); the org-admin distributors page passes its own org-scoped action.
   */
  onSaveName?: (name: string) => Promise<{ success: boolean; error?: string }>;
}

export function DistributorDetailsModal({
  distributor,
  open,
  onOpenChange,
  onSaveName,
}: DistributorDetailsModalProps) {
  const [pending, startTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const [isActive, setIsActive] = useState(distributor.is_active);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(distributor.name ?? '');

  const handleSaveName = () => {
    startTransition(async () => {
      try {
        const result = onSaveName
          ? await onSaveName(name.trim())
          : await updateDistributorAction({
              accountId: distributor.id,
              name: name.trim(),
            });

        if (result.success) {
          toast.success('Name updated');
          setIsEditing(false);
        } else {
          toast.error('Failed to update name');
        }
      } catch {
        toast.error('Failed to update name');
      }
    });
  };

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
          {/* Identity row — name is editable (fixes nameless self-signups). */}
          <div className="flex items-center justify-between gap-2">
            {isEditing ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Member name"
                className="text-lg font-semibold"
                data-test="distributor-name-input"
              />
            ) : (
              <h3 className="text-brand text-lg">
                <span className="font-semibold">
                  {distributor.name || 'Unnamed member'}
                </span>
                {distributor.organization_name && (
                  <span> - {distributor.organization_name}</span>
                )}
              </h3>
            )}
            <div className="flex shrink-0 gap-2">
              {isEditing ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !name.trim()}
                  onClick={handleSaveName}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {pending ? 'Saving...' : 'Save'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  data-test="distributor-edit-name"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit name
                </Button>
              )}
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
