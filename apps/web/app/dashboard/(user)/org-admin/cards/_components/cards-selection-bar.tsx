'use client';

import { useState, useTransition } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { ChevronDown, LibraryBig, X } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';

import type { DistributorOption } from '../_lib/server/cards-page.loader';
import { bulkAssignCardsDistributorAction } from '../_lib/server/cards-server-actions';

interface CardsSelectionBarProps {
  selectedCount: number;
  selectedCardIds: string[];
  distributors: DistributorOption[];
  onClearSelection: () => void;
}

export function CardsSelectionBar({
  selectedCount,
  selectedCardIds,
  distributors,
  onClearSelection,
}: CardsSelectionBarProps) {
  const [pending, startTransition] = useTransition();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    distributorId: string | null;
    distributorName: string | null;
  } | null>(null);

  const handleDistributorSelect = (
    distributorId: string | null,
    distributorName: string | null,
  ) => {
    if (selectedCardIds.length === 0) return;
    setPendingAction({ distributorId, distributorName });
    setShowConfirmation(true);
  };

  const handleConfirmedAssign = () => {
    if (!pendingAction) return;

    startTransition(async () => {
      try {
        const result = await bulkAssignCardsDistributorAction({
          cardIds: selectedCardIds,
          distributorId: pendingAction.distributorId,
        });

        if (result.success) {
          toast.success(
            `${result.assignedCount} card${result.assignedCount === 1 ? '' : 's'} ${
              pendingAction.distributorId ? 'assigned' : 'unassigned'
            } successfully`,
          );
          setShowConfirmation(false);
          setPendingAction(null);
          onClearSelection();
        }
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        toast.error(
          error instanceof Error ? error.message : 'Failed to assign cards',
        );
      }
    });
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className="mb-4 flex items-center justify-between rounded-lg border px-4 py-3"
      style={{ backgroundColor: '#E5E8F6' }}
      data-test="cards-selection-bar"
    >
      <span className="text-sm font-medium">
        {selectedCount} card{selectedCount === 1 ? '' : 's'} selected
      </span>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-brand-400 hover:bg-brand-500 border-brand-400 hover:border-brand-500 text-white hover:text-white"
              disabled={pending}
              data-test="assign-distributor-dropdown"
            >
              <LibraryBig className="mr-1 h-4 w-4" />
              Assign Distributor
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Select Distributor</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {distributors.length === 0 ? (
              <DropdownMenuItem disabled>
                No distributors available
              </DropdownMenuItem>
            ) : (
              <>
                {distributors.map((distributor) => (
                  <DropdownMenuItem
                    key={distributor.id}
                    onClick={() =>
                      handleDistributorSelect(distributor.id, distributor.name)
                    }
                  >
                    {distributor.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDistributorSelect(null, null)}
                  className="text-destructive"
                >
                  Unassign All
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-muted-foreground"
          data-test="clear-selection-button"
        >
          <X className="mr-1 h-4 w-4" />
          Cancel
        </Button>
      </div>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent data-test="selection-bar-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.distributorId ? 'Assign Cards' : 'Unassign Cards'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.distributorId ? (
                <>
                  You are about to assign{' '}
                  <strong>
                    {selectedCount} card{selectedCount === 1 ? '' : 's'}
                  </strong>{' '}
                  to <strong>{pendingAction.distributorName}</strong>.
                </>
              ) : (
                <>
                  You are about to unassign{' '}
                  <strong>
                    {selectedCount} card{selectedCount === 1 ? '' : 's'}
                  </strong>
                  . These cards will become available for reassignment.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedAssign}
              disabled={pending}
              className={
                pendingAction?.distributorId
                  ? 'bg-brand-400 hover:bg-brand-500'
                  : 'bg-destructive hover:bg-destructive/90'
              }
              data-test="selection-bar-confirm-action"
            >
              {pending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {pendingAction?.distributorId
                    ? 'Assigning...'
                    : 'Unassigning...'}
                </>
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
