'use client';

import { usePathname } from 'next/navigation';

/**
 * Renders its children on every marketing route EXCEPT the home route (`/`).
 * T0 requires the cold-open home screen to show only the logo + Get Started +
 * Login, so the shared marketing header/footer are suppressed there while every
 * other marketing page (blog, faq, pricing, legal) keeps its chrome.
 *
 * The header/footer are still server-rendered in the layout and passed in as
 * children; this client wrapper only decides whether to show them.
 */
export function HideOnHome({ children }: React.PropsWithChildren) {
  const pathname = usePathname();

  if (pathname === '/') {
    return null;
  }

  return <>{children}</>;
}
