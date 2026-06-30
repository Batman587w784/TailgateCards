'use client';

import { useTransition } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { ChevronsUpDown } from 'lucide-react';

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

import type { DistributorOption } from '../_lib/server/cards-page.loader';
import { assignCardDistributorAction } from '../_lib/server/cards-server-actions';

interface AssignDistributorDropdownProps {
  cardId: string;
  currentDistributorId: string | null;
  distributors: DistributorOption[];
}

export function AssignDistributorDropdown({
  cardId,
  currentDistributorId,
  distributors,
}: AssignDistributorDropdownProps) {
  const [pending, startTransition] = useTransition();

  const handleAssign = (distributorId: string | null) => {
    if (distributorId === currentDistributorId) return;

    startTransition(async () => {
      try {
        const result = await assignCardDistributorAction({
          cardId,
          distributorId,
        });

        if (result.success) {
          toast.success(
            distributorId
              ? 'Card assigned to distributor'
              : 'Card unassigned from distributor',
          );
        }
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        toast.error(
          error instanceof Error ? error.message : 'Failed to assign card',
        );
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          data-test="assign-distributor-dropdown"
        >
          Select distributor
          <ChevronsUpDown className="ml-1 h-3 w-3" />
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
                onClick={() => handleAssign(distributor.id)}
                className={
                  currentDistributorId === distributor.id
                    ? 'bg-accent'
                    : undefined
                }
              >
                {distributor.name}
                {currentDistributorId === distributor.id && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    (current)
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            {currentDistributorId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleAssign(null)}
                  className="text-destructive"
                >
                  Unassign
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
