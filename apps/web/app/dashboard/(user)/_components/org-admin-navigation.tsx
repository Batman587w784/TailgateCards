'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CreditCard, Trophy, Users } from 'lucide-react';

import { SidebarMenuButton, SidebarMenuItem } from '@kit/ui/shadcn-sidebar';
import { Trans } from '@kit/ui/trans';

export function OrgAdminNavigation() {
  const path = usePathname();

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={path.includes('/dashboard/leaderboard')}
          asChild
        >
          <Link
            className="flex size-full gap-2.5"
            href="/dashboard/leaderboard"
          >
            <Trophy className="h-4" />
            Leaderboard
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={path.includes('/dashboard/org-admin/distributors')}
          asChild
        >
          <Link
            className="flex size-full gap-2.5"
            href="/dashboard/org-admin/distributors"
          >
            <Users className="h-4" />
            <Trans i18nKey="common:routes.distributors" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={path.includes('/dashboard/org-admin/cards')}
          asChild
        >
          <Link
            className="flex size-full gap-2.5"
            href="/dashboard/org-admin/cards"
          >
            <CreditCard className="h-4" />
            <Trans i18nKey="common:routes.cards" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );
}
