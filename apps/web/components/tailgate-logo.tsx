import Image from 'next/image';

import { cn } from '@kit/ui/utils';

export function TailgateLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/images/logo.png"
      alt="Tailgate"
      width={96}
      height={48}
      className={cn('h-12 w-auto', className)}
      priority
    />
  );
}
