'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Settings, Trophy } from 'lucide-react';

import { SidebarMenuButton, SidebarMenuItem } from '@kit/ui/shadcn-sidebar';

export function DistrictAdminNavigation() {
  const path = usePathname();

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={path.includes('/dashboard/leaderboard')}
          asChild
        >
          <Link className="flex size-full gap-2.5" href="/dashboard/leaderboard">
            <Trophy className="h-4" />
            Leaderboard
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={path.includes('/dashboard/district/settings')}
          asChild
        >
          <Link
            className="flex size-full gap-2.5"
            href="/dashboard/district/settings"
          >
            <Settings className="h-4" />
            Settings
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );
}
