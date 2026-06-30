'use client';

import { useState, useTransition } from 'react';

import { Eye, EyeOff, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';

import { refreshMerchantPasscodeAction } from '../_lib/server/entities-server-actions';

interface PasscodeCellProps {
  accountId: string;
  passcode: string | null;
}

export function PasscodeCell({ accountId, passcode }: PasscodeCellProps) {
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
    <div className="flex items-center gap-1">
      <span className="w-12 font-mono text-sm">{displayValue}</span>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsVisible(!isVisible)}
              disabled={!currentPasscode}
            >
              {isVisible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isVisible ? 'Hide passcode' : 'Show passcode'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              disabled={isPending}
            >
              {isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generate new passcode</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
