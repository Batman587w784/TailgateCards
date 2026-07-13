'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  TicketPercent,
  Trophy,
  Users,
  Wallet,
  WalletCards,
} from 'lucide-react';

import { SidebarMenuButton, SidebarMenuItem } from '@kit/ui/shadcn-sidebar';
import { Trans } from '@kit/ui/trans';

export function AdminNavigation() {
  const path = usePathname();

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={path.includes('/dashboard/entities')}
          asChild
        >
          <Link className="flex size-full gap-2.5" href="/dashboard/entities">
            <Users className="h-4" />
            <Trans i18nKey="common:routes.users" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

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
          isActive={path.includes('/dashboard/discounts')}
          asChild
        >
          <Link className="flex size-full gap-2.5" href="/dashboard/discounts">
            <TicketPercent className="h-4" />
            <Trans i18nKey="common:routes.discounts" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={path.includes('/dashboard/payments')}
          asChild
        >
          <Link className="flex size-full gap-2.5" href="/dashboard/payments">
            <WalletCards className="h-4" />
            <Trans i18nKey="common:routes.payments" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton isActive={path === '/dashboard/cards'} asChild>
          <Link className="flex size-full gap-2.5" href="/dashboard/cards">
            <Wallet className="h-4" />
            <Trans i18nKey="common:routes.cards" defaults="Cards" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );
}
