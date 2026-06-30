'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CreditCard } from 'lucide-react';

import { SidebarMenuButton, SidebarMenuItem } from '@kit/ui/shadcn-sidebar';

export function DistributorNavigation() {
  const path = usePathname();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={path.includes('/dashboard/distributor/cards')}
        asChild
      >
        <Link
          className="flex size-full gap-2.5"
          href="/dashboard/distributor/cards"
        >
          <CreditCard className="h-4" />
          Cards
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
