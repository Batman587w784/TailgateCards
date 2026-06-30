'use client';

import { useRouter } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { AppLogo } from '~/components/app-logo';

import type { MobileHeaderProps } from './types';

export function MobileHeader({
  left = 'logo',
  backHref,
  right,
  className,
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header
      className={cn(
        'flex w-full items-center justify-between border-b p-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-sm lg:hidden',
        className,
      )}
    >
      {/* Left side */}
      <div className="flex items-center">
        {left === 'logo' ? (
          <AppLogo />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Right side */}
      {right ? <div className="flex items-center gap-x-2">{right}</div> : null}
    </header>
  );
}
