import Link from 'next/link';

import { cn } from '@kit/ui/utils';

function LogoImage({ className }: { className?: string }) {
  return (
    <img
      src="/images/logo.svg"
      alt="Tailgate"
      className={cn('h-10 w-auto lg:h-12', className)}
    />
  );
}

export function AppLogo({
  href,
  label,
  className,
}: {
  href?: string | null;
  className?: string;
  label?: string;
}) {
  if (href === null) {
    return <LogoImage className={className} />;
  }

  return (
    <Link aria-label={label ?? 'Home Page'} href={href ?? '/'} prefetch={true}>
      <LogoImage className={className} />
    </Link>
  );
}
